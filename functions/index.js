'use strict';

const {onRequest} = require('firebase-functions/v2/https');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {defineSecret} = require('firebase-functions/params');
const admin = require('firebase-admin');
const stripeLib = require('stripe');

admin.initializeApp();

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// Helper: verify Firebase Auth ID token from Authorization: Bearer <token> header
async function verifyAuthToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('Missing or invalid Authorization header');
    err.status = 401;
    throw err;
  }
  return admin.auth().verifyIdToken(authHeader.slice(7));
}

// ---- Your Stripe price IDs for DroneChecker Pro ----
const PRICE_ID_MONTHLY = 'price_1TgjvDBwELWfTObfoMWjvt6N';
const PRICE_ID_YEARLY  = 'price_1ThSwBBwELWfTObfULMmiYjp';

// ---- App URL — where Stripe redirects after checkout ----
const APP_URL = 'https://dronechecker.co.uk/app.html';

// ---- Drone wind thresholds (km/h) — single source of truth in ../drone-thresholds.json ----
const _DRONES_RAW = require('./drone-thresholds.json');
const DRONE_THRESHOLDS = Object.fromEntries(
  Object.entries(_DRONES_RAW).map(([k, {name, ...t}]) => [k, t])
);
const DEFAULT_THRESHOLDS = {windAmber:29,windRed:39,gustAmber:32,gustRed:39};
const MAX_ALERTS = 3; // cap on simultaneous alert profiles per user — keep in sync with app.js

// ---- Durable rate limiter for createCheckoutSession ----
// Limits each uid to MAX_CHECKOUT_CALLS per CHECKOUT_WINDOW_MS. Backed by Firestore
// so the limit holds across the many horizontally-scaled function instances (an
// in-memory Map only limits per-instance and resets on cold start). The Admin SDK
// bypasses security rules; the deny-all rule keeps clients out of this collection.
const CHECKOUT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_CHECKOUT_CALLS = 10;

async function isCheckoutRateLimited(uid) {
  const db = admin.firestore();
  const ref = db.collection('checkoutRateLimits').doc(uid);
  const now = Date.now();
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : null;
      if (!data || (now - (data.windowStart || 0)) > CHECKOUT_WINDOW_MS) {
        tx.set(ref, {windowStart: now, count: 1});
        return false;
      }
      if ((data.count || 0) >= MAX_CHECKOUT_CALLS) return true;
      tx.update(ref, {count: (data.count || 0) + 1});
      return false;
    });
  } catch (e) {
    // Fail open — a Firestore hiccup should not block a legitimate checkout.
    console.error('Rate limit check failed (allowing):', e);
    return false;
  }
}

// WMO codes that indicate bad weather — matches app.html flyRating logic
const WMO_RED   = [95,96,99,65,75,77,82];
const WMO_AMBER = [61,80,71,73,51,56,57,67];
// Precip-adjustable codes (app clears these when precip < 20%)
const WMO_PRECIP_CLEAR = [51,53,55,61,63,65,80,81,82];

function alertFlyRating(wind, gust, vis, wmo, precip, thresholds) {
  const t = thresholds || DEFAULT_THRESHOLDS;

  // Apply precip adjustment: if rain chance < 20%, treat as clear sky
  let w = wmo;
  if (precip < 20 && WMO_PRECIP_CLEAR.includes(w)) w = 1;

  let lvl = 'green';
  if (wind >= t.windRed || gust >= t.gustRed) lvl = 'red';
  else if (wind >= t.windAmber || gust >= t.gustAmber) lvl = 'amber';

  if (vis < 1500) lvl = 'red';
  else if (vis < 3000 && lvl === 'green') lvl = 'amber';

  if (WMO_RED.includes(w)) lvl = 'red';
  else if (WMO_AMBER.includes(w) && lvl !== 'red') lvl = 'amber';

  return lvl;
}

function isWithinWindow(windowStart, windowEnd, utcOffsetMinutes, now) {
  const localHour = (now.getUTCHours() + Math.round((utcOffsetMinutes || 0) / 60) + 24) % 24;
  if (windowStart <= windowEnd) {
    return localHour >= windowStart && localHour < windowEnd;
  }
  return localHour >= windowStart || localHour < windowEnd;
}

function getLocalHour(now, utcOffsetMinutes) {
  return (now.getUTCHours() + Math.round((utcOffsetMinutes || 0) / 60) + 24) % 24;
}

function getLocalDay(now, utcOffsetMinutes) {
  const localMs = now.getTime() + (utcOffsetMinutes || 0) * 60000;
  return new Date(localMs).getUTCDay(); // 0=Sun, 6=Sat
}

async function sendFcmData(fcmToken, title, body, uid) {
  const message = {
    data: { title, body, url: '/app.html' },
    token: fcmToken,
  };
  try {
    await admin.messaging().send(message);
    console.log(`FCM sent to uid=${uid}: ${title}`);
    return true;
  } catch (err) {
    console.error(`FCM send failed uid=${uid}:`, err.code, err.message);
    if (
      err.code === 'messaging/registration-token-not-registered' ||
      err.code === 'messaging/invalid-registration-token'
    ) {
      return 'stale';
    }
    return false;
  }
}

// ----------------------------------------------------------------
// createCheckoutSession
// Called from the app when the user taps "Subscribe"
// Expects JSON body: { uid, email }
// Returns JSON: { url } — the Stripe Checkout URL to redirect to
// ----------------------------------------------------------------
exports.createCheckoutSession = onRequest(
  {secrets: [STRIPE_SECRET_KEY], cors: ['https://dronechecker.co.uk']},
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    let decodedToken;
    try {
      decodedToken = await verifyAuthToken(req);
    } catch (err) {
      res.status(401).json({error: 'Unauthorised'});
      return;
    }

    const {uid, email, plan} = req.body;

    if (!uid || !email) {
      res.status(400).json({error: 'Missing uid or email'});
      return;
    }

    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({error: 'Invalid email'});
      return;
    }

    if (decodedToken.uid !== uid) {
      res.status(403).json({error: 'Forbidden'});
      return;
    }

    if (await isCheckoutRateLimited(uid)) {
      res.status(429).json({error: 'Too many requests. Please try again later.'});
      return;
    }

    const priceId = (plan === 'yearly') ? PRICE_ID_YEARLY : PRICE_ID_MONTHLY;

    try {
      const stripe = stripeLib(STRIPE_SECRET_KEY.value());

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer_email: email,
        line_items: [{price: priceId, quantity: 1}],
        success_url: APP_URL + '?pro=success',
        cancel_url:  APP_URL + '?pro=cancelled',
        metadata: {uid},
        subscription_data: {
          metadata: {uid},
        },
      });

      res.json({url: session.url});
    } catch (err) {
      console.error('Stripe checkout error:', err);
      res.status(500).json({error: 'Could not create checkout session'});
    }
  }
);

// ----------------------------------------------------------------
// createPortalSession
// Called from the app when the user taps "Manage subscription"
// Expects JSON body: { uid }
// Returns JSON: { url } — the Stripe Customer Portal URL
// ----------------------------------------------------------------
exports.createPortalSession = onRequest(
  {secrets: [STRIPE_SECRET_KEY], cors: ['https://dronechecker.co.uk']},
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    let decodedToken;
    try {
      decodedToken = await verifyAuthToken(req);
    } catch (err) {
      res.status(401).json({error: 'Unauthorised'});
      return;
    }

    const {uid} = req.body;

    if (!uid) {
      res.status(400).json({error: 'Missing uid'});
      return;
    }

    if (decodedToken.uid !== uid) {
      res.status(403).json({error: 'Forbidden'});
      return;
    }

    try {
      const db = admin.firestore();
      const userDoc = await db.collection('users').doc(uid).get();

      if (!userDoc.exists) {
        res.status(404).json({error: 'User not found'});
        return;
      }

      const stripeCustomerId = userDoc.data().stripeCustomerId;

      if (!stripeCustomerId) {
        res.status(400).json({error: 'No Stripe customer found for this user'});
        return;
      }

      const stripe = stripeLib(STRIPE_SECRET_KEY.value());

      const session = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: APP_URL,
      });

      res.json({url: session.url});
    } catch (err) {
      console.error('Portal session error:', err);
      res.status(500).json({error: 'Could not create portal session'});
    }
  }
);


// Stripe calls this after successful payment events
// Sets isPro: true in Firestore for the relevant user
// ----------------------------------------------------------------
exports.stripeWebhook = onRequest(
  {secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET], rawBody: true},
  async (req, res) => {
    const stripe = stripeLib(STRIPE_SECRET_KEY.value());
    const sig = req.headers['stripe-signature'];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (err) {
      console.error('Webhook signature error:', err.message);
      res.status(400).send('Webhook signature verification failed');
      return;
    }

    const db = admin.firestore();

    switch (event.type) {

      // Payment succeeded — activate Pro
      case 'checkout.session.completed': {
        const session = event.data.object;
        const uid = session.metadata && session.metadata.uid;
        if (uid) {
          await db.collection('users').doc(uid).set(
            {
              isPro: true,
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
              proActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            {merge: true}
          );
          console.log('Pro activated for uid:', uid);
        }
        break;
      }

      // Subscription renewed successfully — keep Pro active
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        // Try to get uid directly from invoice metadata first (new API structure)
        let uid = invoice.parent &&
                  invoice.parent.subscription_details &&
                  invoice.parent.subscription_details.metadata &&
                  invoice.parent.subscription_details.metadata.uid;
        // Fallback: retrieve subscription if uid not in invoice
        if (!uid) {
          const subId = (invoice.parent &&
                         invoice.parent.subscription_details &&
                         invoice.parent.subscription_details.subscription) ||
                        invoice.subscription;
          if (subId) {
            try {
              const sub = await stripe.subscriptions.retrieve(subId);
              uid = sub.metadata && sub.metadata.uid;
            } catch(e) {
              console.error('Could not retrieve subscription:', e);
            }
          }
        }
        if (uid) {
          await db.collection('users').doc(uid).set(
            {isPro: true, lastRenewalAt: admin.firestore.FieldValue.serverTimestamp()},
            {merge: true}
          );
          console.log('Pro renewed for uid:', uid);
        }
        break;
      }

      // Subscription fully cancelled — revoke Pro.
      // Stripe fires this only once dunning/retries are exhausted, so it is
      // the authoritative revocation signal.
      case 'customer.subscription.deleted': {
        const obj = event.data.object;
        const subId = obj.subscription || obj.id;
        if (subId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subId);
            const uid = sub.metadata && sub.metadata.uid;
            if (uid) {
              await db.collection('users').doc(uid).set(
                {isPro: false, proRevokedAt: admin.firestore.FieldValue.serverTimestamp()},
                {merge: true}
              );
              console.log('Pro revoked for uid:', uid);
            }
          } catch (e) {
            console.error('Could not revoke Pro:', e);
          }
        }
        break;
      }

      // A single failed charge — do NOT revoke. Stripe's dunning will retry,
      // and customer.subscription.deleted handles the final cancellation.
      case 'invoice.payment_failed': {
        console.log('invoice.payment_failed received — deferring to Stripe dunning / subscription.deleted');
        break;
      }

      default:
        break;
    }

    res.json({received: true});
  }
);

// ----------------------------------------------------------------
// sendFlightAlerts
// Runs every hour. For each Pro user with alerts enabled, fetches
// weather at their saved location and sends an FCM push if a
// flyable window has just opened (transition from not-good to good).
// ----------------------------------------------------------------
// ----------------------------------------------------------------
// evaluateAndNotifyAlert
// Core per-alert decision logic shared by both the multi-alert path
// and the legacy single-alert path below — given one alert's config
// and its last-known notification state, fetches current conditions,
// decides whether to send, and returns whichever state fields changed
// (the caller persists them at whichever field path matches its shape:
// `alertState.<id>.*` for the new array, flat `alertXxx` for legacy).
// ----------------------------------------------------------------
async function evaluateAndNotifyAlert(alert, state, windThresholds, fcmToken, uid, now) {
  if (!alert.lat || !alert.lng) return {newState: null, staleToken: false};

  const utcOffset = alert.utcOffsetMinutes || 0;
  const localHour = getLocalHour(now, utcOffset);
  const localDay  = getLocalDay(now, utcOffset);

  // Active days filter (default: all days)
  const activeDays = alert.activeDays;
  const isActiveDay = !activeDays || !activeDays.length || activeDays.includes(localDay);

  // Morning forecast check
  const morningEnabled = alert.morningForecastEnabled;
  const morningHour    = alert.morningForecastHour !== undefined ? alert.morningForecastHour : 7;
  const isMorningTime  = !!(morningEnabled && isActiveDay && localHour === morningHour);

  // Fly-window check
  const windowStart = alert.windowStart !== undefined ? alert.windowStart : 6;
  const windowEnd   = alert.windowEnd   !== undefined ? alert.windowEnd   : 21;
  const inWindow    = isActiveDay && isWithinWindow(windowStart, windowEnd, utcOffset, now);

  if (!isMorningTime && !inWindow) return {newState: null, staleToken: false};

  // Resolve thresholds
  const droneKey  = alert.droneKey || 'mini4pro';
  const customThr = windThresholds && windThresholds[droneKey];
  const thresholds = customThr || DRONE_THRESHOLDS[droneKey] || DEFAULT_THRESHOLDS;

  // Fetch current conditions from Open-Meteo
  let rating = 'red';
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${alert.lat}&longitude=${alert.lng}` +
      `&hourly=wind_speed_10m,wind_gusts_10m,visibility,weather_code,precipitation_probability` +
      `&wind_speed_unit=kmh&timezone=UTC&forecast_days=1&timeformat=unixtime`;
    const resp = await fetch(url, {signal: AbortSignal.timeout(8000)});
    if (!resp.ok) throw new Error('Open-Meteo HTTP ' + resp.status);
    const wx = await resp.json();
    const h = wx.hourly;
    const nowTs = Math.floor(now.getTime() / 1000);
    let idx = 0;
    for (let i = 0; i < h.time.length; i++) {
      if (h.time[i] <= nowTs) idx = i; else break;
    }
    const wind   = h.wind_speed_10m            ? (h.wind_speed_10m[idx]            || 0)     : 0;
    const gust   = h.wind_gusts_10m            ? (h.wind_gusts_10m[idx]            || 0)     : 0;
    const vis    = h.visibility                 ? (h.visibility[idx]                || 10000) : 10000;
    const wmo    = h.weather_code              ? (h.weather_code[idx]              || 0)     : 0;
    const precip = h.precipitation_probability ? (h.precipitation_probability[idx] || 0)     : 0;
    rating = alertFlyRating(wind, gust, vis, wmo, precip, thresholds);
    console.log(`uid=${uid} wind=${wind} gust=${gust} vis=${vis} wmo=${wmo} precip=${precip} → ${rating}`);
  } catch (err) {
    console.error(`Weather fetch failed for uid ${uid}:`, err.message);
    return {newState: null, staleToken: false};
  }

  const locationName = alert.locationName || 'your saved location';
  const droneName = alert.droneName || (_DRONES_RAW[alert.droneKey] && _DRONES_RAW[alert.droneKey].name) || 'Your drone';
  const minRating = alert.minRating || 'green';
  const isGood  = minRating === 'amber' ? (rating === 'green' || rating === 'amber') : (rating === 'green');
  const wasGood = state.lastRatingGood === true;
  const ratingWord = rating === 'green' ? 'good' : rating === 'amber' ? 'marginal' : 'poor';

  const newState = {lastCheckedAt: admin.firestore.FieldValue.serverTimestamp()};
  let staleToken = false;

  // ---- Morning forecast ----
  if (isMorningTime) {
    const lastMorning = state.morningLastSentAt;
    const hrsSinceMorning = lastMorning
      ? (now.getTime() - lastMorning.toDate().getTime()) / 3600000
      : 999;
    if (hrsSinceMorning >= 23) {
      const body = isGood
        ? `${droneName}: conditions look ${ratingWord} for flying at ${locationName} today. Tap to check.`
        : `${droneName}: flying conditions at ${locationName} look ${ratingWord} today. Check back later.`;
      const result = await sendFcmData(fcmToken, `☀️ Morning forecast — ${locationName}`, body, uid);
      if (result === 'stale') { staleToken = true; }
      else if (result) { newState.morningLastSentAt = admin.firestore.FieldValue.serverTimestamp(); }
    }
  }

  // ---- Fly-window notifications ----
  if (inWindow && !staleToken) {
    newState.lastRatingGood = isGood;

    if (isGood && !wasGood) {
      // Window just opened
      const result = await sendFcmData(
        fcmToken,
        `✈ Fly window open — ${locationName}`,
        `${droneName}: conditions are now ${ratingWord} for flying. Tap to check before you launch.`,
        uid
      );
      if (result === 'stale') { staleToken = true; }
      else if (result) {
        newState.lastSentAt = admin.firestore.FieldValue.serverTimestamp();
        newState.repeatLastSentAt = admin.firestore.FieldValue.serverTimestamp();
      }

    } else if (!isGood && wasGood && alert.notifyOnClose) {
      // Window just closed
      const result = await sendFcmData(
        fcmToken,
        `⛅ Conditions changing — ${locationName}`,
        `${droneName}: flying conditions at ${locationName} have deteriorated. Check back later.`,
        uid
      );
      if (result === 'stale') { staleToken = true; }
      else if (result) {
        newState.repeatLastSentAt = admin.firestore.FieldValue.delete();
      }

    } else if (isGood && wasGood && alert.repeatIntervalHours > 0) {
      // Still good — repeat reminder
      const repeatLast = state.repeatLastSentAt || state.lastSentAt;
      const hrsSinceRepeat = repeatLast
        ? (now.getTime() - repeatLast.toDate().getTime()) / 3600000
        : 999;
      if (hrsSinceRepeat >= alert.repeatIntervalHours) {
        const result = await sendFcmData(
          fcmToken,
          `🔔 Still flyable — ${locationName}`,
          `${droneName}: conditions remain ${ratingWord} at ${locationName}. Tap to check.`,
          uid
        );
        if (result === 'stale') { staleToken = true; }
        else if (result) { newState.repeatLastSentAt = admin.firestore.FieldValue.serverTimestamp(); }
      }
    }
  }

  return {newState, staleToken};
}

exports.sendFlightAlerts = onSchedule(
  {schedule: 'every 60 minutes', timeZone: 'UTC', timeoutSeconds: 120},
  async () => {
    const db = admin.firestore();
    const now = new Date();

    // Get all Pro users (filter alert-enabled in code to avoid composite index)
    let snapshot;
    try {
      snapshot = await db.collection('users').where('isPro', '==', true).get();
    } catch (err) {
      console.error('Firestore query failed:', err);
      return;
    }

    if (snapshot.empty) return;

    const tasks = snapshot.docs.map(async (doc) => {
      const uid = doc.id;
      const data = doc.data();
      const fcmToken = data.fcmToken;
      if (!fcmToken) return;

      // ---- Multi-alert path (post-migration: `alerts` array + `alertState` map) ----
      if (data.alerts) {
        if (data.alertsEnabled === false) return; // master pause switch — independent of each alert's own `enabled`
        const alertsArr = data.alerts.slice(0, MAX_ALERTS);
        const update = {};
        let staleToken = false;

        for (const alert of alertsArr) {
          if (staleToken) break;
          if (!alert.enabled) continue;
          const state = (data.alertState && data.alertState[alert.id]) || {};
          const result = await evaluateAndNotifyAlert(alert, state, data.windThresholds, fcmToken, uid, now);
          if (result.newState) {
            for (const key of Object.keys(result.newState)) {
              update[`alertState.${alert.id}.${key}`] = result.newState[key];
            }
          }
          if (result.staleToken) staleToken = true;
        }

        if (staleToken) {
          update.fcmToken = admin.firestore.FieldValue.delete();
          update.alertAutoDisabled = true;
        }

        if (Object.keys(update).length) {
          await doc.ref.set(update, {merge: true});
        }
        return;
      }

      // ---- Legacy single-alert path (user not yet migrated client-side) ----
      const alertSettings = data.alertSettings;
      if (!alertSettings || !alertSettings.enabled) return;

      const legacyState = {
        lastRatingGood: data.alertLastRatingGood,
        morningLastSentAt: data.alertMorningLastSentAt,
        lastSentAt: data.alertLastSentAt,
        repeatLastSentAt: data.alertRepeatLastSentAt,
      };
      const result = await evaluateAndNotifyAlert(alertSettings, legacyState, data.windThresholds, fcmToken, uid, now);

      const update = {};
      if (result.newState) {
        if ('lastCheckedAt' in result.newState) update.alertLastCheckedAt = result.newState.lastCheckedAt;
        if ('morningLastSentAt' in result.newState) update.alertMorningLastSentAt = result.newState.morningLastSentAt;
        if ('lastRatingGood' in result.newState) update.alertLastRatingGood = result.newState.lastRatingGood;
        if ('lastSentAt' in result.newState) update.alertLastSentAt = result.newState.lastSentAt;
        if ('repeatLastSentAt' in result.newState) update.alertRepeatLastSentAt = result.newState.repeatLastSentAt;
      }
      if (result.staleToken) {
        update.fcmToken = admin.firestore.FieldValue.delete();
        update['alertSettings.enabled'] = false;
        update.alertAutoDisabled = true;
      }

      if (Object.keys(update).length) {
        await doc.ref.set(update, {merge: true});
      }
    });

    await Promise.allSettled(tasks);
    console.log(`Alert check done — ${snapshot.docs.length} Pro users scanned`);
  }
);

// ----------------------------------------------------------------
// sendIdRenewalReminders
// Runs daily. Sends a push reminder before each Pro user's CAA
// Operator ID / Flyer ID date, based on their configured lead time
// (default 14 days). Dedup is keyed on the expiry date itself, so
// updating the date after renewing naturally re-arms the reminder.
// ----------------------------------------------------------------
exports.sendIdRenewalReminders = onSchedule(
  {schedule: 'every 24 hours', timeZone: 'UTC', timeoutSeconds: 60},
  async () => {
    const db = admin.firestore();
    const now = new Date();
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    function daysUntil(dateStr) {
      const [y, m, d] = dateStr.split('-').map(Number);
      return Math.round((Date.UTC(y, m - 1, d) - todayUTC) / 86400000);
    }

    let snapshot;
    try {
      snapshot = await db.collection('users').where('isPro', '==', true).get();
    } catch (err) {
      console.error('sendIdRenewalReminders: Firestore query failed:', err);
      return;
    }

    if (snapshot.empty) return;

    const tasks = snapshot.docs.map(async (doc) => {
      const uid = doc.id;
      const data = doc.data();
      const ids = data.droneIds;
      const fcmToken = data.fcmToken;
      if (!ids || !fcmToken) return;

      const checks = [
        {key: 'operator', label: 'Operator ID', expiry: ids.operatorIdExpiry, days: ids.operatorReminderDays, verb: 'renews'},
        {key: 'flyer', label: 'Flyer ID', expiry: ids.flyerIdExpiry, days: ids.flyerReminderDays, verb: 'expires'},
      ];

      const update = {};
      let staleToken = false;

      for (const c of checks) {
        if (!c.expiry || staleToken) continue;
        const lead = c.days || 14;
        const remaining = daysUntil(c.expiry);
        if (remaining > lead) continue;
        if (ids[`${c.key}ReminderSentForExpiry`] === c.expiry) continue;

        const body = remaining < 0
          ? `Your ${c.label} ${c.verb === 'renews' ? 'renewal' : 'expiry'} was ${Math.abs(remaining)} day${Math.abs(remaining) === 1 ? '' : 's'} ago.`
          : remaining === 0
            ? `Your ${c.label} ${c.verb} today.`
            : `Your ${c.label} ${c.verb} in ${remaining} day${remaining === 1 ? '' : 's'}.`;

        const result = await sendFcmData(fcmToken, `🪪 ${c.label} reminder`, body, uid);
        if (result === 'stale') { staleToken = true; }
        else if (result) { update[`droneIds.${c.key}ReminderSentForExpiry`] = c.expiry; }
      }

      if (staleToken) {
        update.fcmToken = admin.firestore.FieldValue.delete();
      }
      if (Object.keys(update).length) {
        await doc.ref.set(update, {merge: true});
      }
    });

    await Promise.allSettled(tasks);
    console.log(`sendIdRenewalReminders done — ${snapshot.docs.length} Pro users scanned`);
  }
);

// ----------------------------------------------------------------
// cleanupExpiredAccounts
// Runs weekly. Deletes Firestore documents for non-Pro users whose
// subscription was revoked 90+ days ago, or who signed up but never
// subscribed and created their account 90+ days ago.
// Satisfies GDPR storage-limitation principle (see Privacy Policy §3.5).
// ----------------------------------------------------------------
exports.cleanupExpiredAccounts = onSchedule(
  {schedule: 'every sunday 02:00', timeZone: 'UTC', timeoutSeconds: 300},
  async () => {
    const db = admin.firestore();
    const RETENTION_DAYS = 90;
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    let snapshot;
    try {
      snapshot = await db.collection('users').where('isPro', '==', false).get();
    } catch (err) {
      console.error('cleanupExpiredAccounts: Firestore query failed:', err);
      return;
    }

    if (snapshot.empty) {
      console.log('cleanupExpiredAccounts: no non-Pro users found');
      return;
    }

    const toDelete = [];
    snapshot.docs.forEach(doc => {
      const d = doc.data();
      const revokedAt = d.proRevokedAt && d.proRevokedAt.toDate ? d.proRevokedAt.toDate() : null;
      const createdAt  = d.createdAt  && d.createdAt.toDate  ? d.createdAt.toDate()  : null;

      if (revokedAt && revokedAt < cutoff) {
        // Subscription was cancelled/revoked more than 90 days ago
        toDelete.push(doc.ref);
      } else if (!revokedAt && createdAt && createdAt < cutoff) {
        // Account created 90+ days ago but user never subscribed — minimal data, safe to clear
        toDelete.push(doc.ref);
      }
    });

    if (toDelete.length === 0) {
      console.log('cleanupExpiredAccounts: no expired accounts to delete');
      return;
    }

    // Firestore batch max is 500 writes — process in chunks
    const CHUNK = 500;
    for (let i = 0; i < toDelete.length; i += CHUNK) {
      const batch = db.batch();
      toDelete.slice(i, i + CHUNK).forEach(ref => batch.delete(ref));
      await batch.commit();
    }

    console.log(`cleanupExpiredAccounts: deleted ${toDelete.length} expired account(s)`);
  }
);
