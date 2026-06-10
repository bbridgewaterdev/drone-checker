'use strict';

const {onRequest} = require('firebase-functions/v2/https');
const {defineSecret} = require('firebase-functions/params');
const admin = require('firebase-admin');
const stripeLib = require('stripe');

admin.initializeApp();

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// ---- Your Stripe price ID for DroneChecker Pro ----
const PRICE_ID = 'price_1TgjvDBwELWfTObfoMWjvt6N';

// ---- App URL — where Stripe redirects after checkout ----
const APP_URL = 'https://dronechecker.co.uk/app.html';

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

    const {uid, email} = req.body;

    if (!uid || !email) {
      res.status(400).json({error: 'Missing uid or email'});
      return;
    }

    try {
      const stripe = stripeLib(STRIPE_SECRET_KEY.value());

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer_email: email,
        line_items: [{price: PRICE_ID, quantity: 1}],
        success_url: APP_URL + '?pro=success',
        cancel_url:  APP_URL + '?pro=cancelled',
        metadata: {uid}, // pass Firebase UID so webhook can find the user
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
// stripeWebhook
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
        const sub = await stripe.subscriptions.retrieve(invoice.subscription);
        const uid = sub.metadata && sub.metadata.uid;
        if (uid) {
          await db.collection('users').doc(uid).set(
            {isPro: true, lastRenewalAt: admin.firestore.FieldValue.serverTimestamp()},
            {merge: true}
          );
        }
        break;
      }

      // Payment failed or subscription cancelled — revoke Pro
      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
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

      default:
        // Ignore other event types
        break;
    }

    res.json({received: true});
  }
);
