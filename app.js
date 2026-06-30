function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function csvCell(v){
  return '"'+String(v==null?'':v).replace(/"/g,'""')+'"';
}
var CAA_OPERATOR_FEE = '£12.34';
var CAA_OPERATOR_FEE_NOTE = '£12.34/year — verify on caa.co.uk';
var DRONES={
  lito1:{name:'DJI Lito 1',windAmber:29,windRed:39,gustAmber:32,gustRed:39},
  litox1:{name:'DJI Lito X1',windAmber:29,windRed:39,gustAmber:32,gustRed:39},
  neo:{name:'DJI Neo',windAmber:18,windRed:29,gustAmber:21,gustRed:29},
  neo2:{name:'DJI Neo 2',windAmber:29,windRed:39,gustAmber:32,gustRed:39},
  flip:{name:'DJI Flip',windAmber:29,windRed:39,gustAmber:32,gustRed:39},
  mini1:{name:'DJI Mini 1',windAmber:18,windRed:29,gustAmber:21,gustRed:29},
  mini4k:{name:'DJI Mini 4K',windAmber:29,windRed:39,gustAmber:32,gustRed:39},
  mini2:{name:'DJI Mini 2 / Mini 2 SE',windAmber:22,windRed:38,gustAmber:25,gustRed:38},
  mini3:{name:'DJI Mini 3',windAmber:29,windRed:39,gustAmber:32,gustRed:39},
  mini3pro:{name:'DJI Mini 3 Pro',windAmber:29,windRed:39,gustAmber:32,gustRed:39},
  mini4pro:{name:'DJI Mini 4 Pro',windAmber:29,windRed:39,gustAmber:32,gustRed:39},
  mini5pro:{name:'DJI Mini 5 Pro',windAmber:33,windRed:43,gustAmber:36,gustRed:43},
  air2s:{name:'DJI Air 2S',windAmber:29,windRed:39,gustAmber:32,gustRed:39},
  air3:{name:'DJI Air 3 / 3S',windAmber:33,windRed:43,gustAmber:36,gustRed:43},
  mavic3:{name:'DJI Mavic 3 Pro / Classic',windAmber:33,windRed:43,gustAmber:36,gustRed:43},
  mavic4pro:{name:'DJI Mavic 4 Pro',windAmber:33,windRed:43,gustAmber:36,gustRed:43},
  phantom4pro:{name:'DJI Phantom 4 Pro',windAmber:29,windRed:39,gustAmber:32,gustRed:39},
  avata2:{name:'DJI Avata 2',windAmber:29,windRed:39,gustAmber:32,gustRed:39},
  avata360:{name:'DJI Avata 360',windAmber:29,windRed:39,gustAmber:32,gustRed:39},
  autel_nano:{name:'Autel EVO Nano+',windAmber:29,windRed:38,gustAmber:32,gustRed:38},
  autel_lite:{name:'Autel EVO Lite+',windAmber:33,windRed:43,gustAmber:36,gustRed:43},
  potensic_atom_se:{name:'Potensic Atom SE',windAmber:29,windRed:39,gustAmber:32,gustRed:39},
  potensic_atom2:{name:'Potensic Atom 2',windAmber:29,windRed:39,gustAmber:32,gustRed:39},
  hoverair_x1:{name:'HoverAir X1',windAmber:18,windRed:29,gustAmber:21,gustRed:29},
  hoverair_x1pro:{name:'HoverAir X1 Pro / ProMax',windAmber:29,windRed:39,gustAmber:32,gustRed:39},
  generic_light:{name:'Generic Light (<500g)',windAmber:22,windRed:29,gustAmber:25,gustRed:29},
  generic_heavy:{name:'Generic Heavy (>500g)',windAmber:29,windRed:39,gustAmber:32,gustRed:39},
};
// Refresh thresholds from the canonical /drone-thresholds.json (single source of truth
// shared with Cloud Functions). Falls back silently to hardcoded values above if offline.
(function(){
  var CACHE_KEY='dc_drone_thresholds',TS_KEY='dc_drone_thresholds_ts',TTL=86400000;
  try{
    var cached=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
    var ts=parseInt(localStorage.getItem(TS_KEY)||'0');
    if(cached&&Date.now()-ts<TTL){Object.assign(DRONES,cached);return;}
  }catch(e){}
  fetch('/drone-thresholds.json').then(function(r){return r.ok?r.json():null;}).then(function(data){
    if(!data)return;
    Object.assign(DRONES,data);
    try{localStorage.setItem(CACHE_KEY,JSON.stringify(data));localStorage.setItem(TS_KEY,String(Date.now()));}catch(e){}
  }).catch(function(){});
}());
var APP_VERSION='1.8.7';
var isIOS=(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.userAgent.includes('Mac')&&'ontouchend' in document))&&!window.MSStream;
var isAndroid=/Android/.test(navigator.userAgent);
var isStandalone=window.matchMedia('(display-mode: standalone)').matches||!!window.navigator.standalone;
var selectedDrone='mini4pro',uLat=null,uLng=null,wxData=null,currentKp=0,kpForecast=[],unitMode='kmh',tempMode='c',lastUpdated=null,windMap=null,windAnimFrame=null,ghRefreshTimer=null,wxLocUtcOffsetMs=0,ghMap=null;
var UK_FRZS=[
  {n:'Heathrow',i:'EGLL',lat:51.4775,lng:-0.4614,r:5000},
  {n:'Gatwick',i:'EGKK',lat:51.1537,lng:-0.1821,r:5000},
  {n:'Stansted',i:'EGSS',lat:51.885,lng:0.235,r:5000},
  {n:'Luton',i:'EGGW',lat:51.8747,lng:-0.3683,r:5000},
  {n:'London City',i:'EGLC',lat:51.5048,lng:0.0495,r:2500},
  {n:'Southend',i:'EGMC',lat:51.5714,lng:0.6956,r:2500},
  {n:'Manchester',i:'EGCC',lat:53.3537,lng:-2.2750,r:5000},
  {n:'Birmingham',i:'EGBB',lat:52.4539,lng:-1.7480,r:5000},
  {n:'Edinburgh',i:'EGPH',lat:55.9500,lng:-3.3725,r:5000},
  {n:'Glasgow',i:'EGPF',lat:55.8719,lng:-4.4331,r:5000},
  {n:'Bristol',i:'EGGD',lat:51.3827,lng:-2.7191,r:5000},
  {n:'Leeds Bradford',i:'EGNM',lat:53.8659,lng:-1.6606,r:5000},
  {n:'Newcastle',i:'EGNT',lat:55.0375,lng:-1.6917,r:5000},
  {n:'Liverpool',i:'EGGP',lat:53.3336,lng:-2.8497,r:5000},
  {n:'East Midlands',i:'EGNX',lat:52.8311,lng:-1.3281,r:5000},
  {n:'Cardiff',i:'EGFF',lat:51.3967,lng:-3.3433,r:5000},
  {n:'Southampton',i:'EGHI',lat:50.9503,lng:-1.3568,r:3000},
  {n:'Aberdeen',i:'EGPD',lat:57.2019,lng:-2.1978,r:5000},
  {n:'Belfast Intl',i:'EGAA',lat:54.6575,lng:-6.2158,r:5000},
  {n:'Belfast City',i:'EGAC',lat:54.6181,lng:-5.8747,r:3000},
  {n:'Inverness',i:'EGPE',lat:57.5425,lng:-4.0475,r:3000},
  {n:'Exeter',i:'EGTE',lat:50.7344,lng:-3.4139,r:3000},
  {n:'Norwich',i:'EGSH',lat:52.6758,lng:1.2828,r:3000},
  {n:'Durham Tees',i:'EGNV',lat:54.5092,lng:-1.4294,r:3000},
  {n:'Doncaster',i:'EGCN',lat:53.4806,lng:-1.0106,r:3000},
  {n:'Humberside',i:'EGNJ',lat:53.5744,lng:-0.3508,r:3000},
  {n:'Bournemouth',i:'EGHH',lat:50.7800,lng:-1.8425,r:3000},
  {n:'Newquay',i:'EGDG',lat:50.4406,lng:-4.9954,r:3000},
  {n:'Prestwick',i:'EGPK',lat:55.5094,lng:-4.5867,r:3000},
];
// Camera specs per drone, used for the photography settings recommendation (Photo Conditions card).
// Sourced from published manufacturer specs where available; entries flagged isEstimate use a
// same-sensor-class approximation (unverifiable or unreleased model) — treated as a guide, not a spec sheet.
// isoCeiling is the approximate ISO a sensor of that size still renders cleanly (noise floor, not the
// hardware max) — bigger sensors gather more light per pixel and tolerate a higher ISO before noise shows.
var SENSOR_ISO_CEILING={'1/2.3"':800,'1/2"':1000,'1/1.3"':1600,'1/1.28"':1600,'1"':3200,'4/3"':6400};
var DRONE_CAMERA={
  lito1:{sensor:'1/1.3"',apertureMin:1.7,apertureMax:1.7,apertureFixed:true,isoBase:100,isoVideoMax:6400,isEstimate:true},
  litox1:{sensor:'1/1.3"',apertureMin:1.7,apertureMax:1.7,apertureFixed:true,isoBase:100,isoVideoMax:6400,isEstimate:true},
  neo:{sensor:'1/2"',apertureMin:2.8,apertureMax:2.8,apertureFixed:true,isoBase:100,isoVideoMax:3200},
  neo2:{sensor:'1/2"',apertureMin:2.2,apertureMax:2.2,apertureFixed:true,isoBase:100,isoVideoMax:3200},
  flip:{sensor:'1/1.3"',apertureMin:1.7,apertureMax:1.7,apertureFixed:true,isoBase:100,isoVideoMax:6400},
  mini1:{sensor:'1/2.3"',apertureMin:2.8,apertureMax:2.8,apertureFixed:true,isoBase:100,isoVideoMax:1600},
  mini4k:{sensor:'1/2.3"',apertureMin:2.8,apertureMax:2.8,apertureFixed:true,isoBase:100,isoVideoMax:6400},
  mini2:{sensor:'1/2.3"',apertureMin:2.8,apertureMax:2.8,apertureFixed:true,isoBase:100,isoVideoMax:6400},
  mini3:{sensor:'1/1.3"',apertureMin:1.7,apertureMax:1.7,apertureFixed:true,isoBase:100,isoVideoMax:6400},
  mini3pro:{sensor:'1/1.3"',apertureMin:1.7,apertureMax:1.7,apertureFixed:true,isoBase:100,isoVideoMax:6400},
  mini4pro:{sensor:'1/1.3"',apertureMin:1.7,apertureMax:1.7,apertureFixed:true,isoBase:100,isoVideoMax:6400},
  mini5pro:{sensor:'1"',apertureMin:1.8,apertureMax:1.8,apertureFixed:true,isoBase:100,isoVideoMax:6400},
  air2s:{sensor:'1"',apertureMin:2.8,apertureMax:2.8,apertureFixed:true,isoBase:100,isoVideoMax:6400},
  air3:{sensor:'1" / 1/1.3" (dual-cam)',isoCeiling:3200,apertureMin:1.7,apertureMax:1.7,apertureFixed:true,isoBase:100,isoVideoMax:6400},
  mavic3:{sensor:'4/3"',apertureMin:2.8,apertureMax:11,apertureFixed:false,isoBase:100,isoVideoMax:12800},
  mavic4pro:{sensor:'4/3"',apertureMin:1.7,apertureMax:11,apertureFixed:false,isoBase:100,isoVideoMax:12800},
  phantom4pro:{sensor:'1"',apertureMin:2.8,apertureMax:11,apertureFixed:false,isoBase:100,isoVideoMax:12800},
  avata2:{sensor:'1/1.3"',apertureMin:2.8,apertureMax:2.8,apertureFixed:true,isoBase:100,isoVideoMax:6400},
  avata360:{sensor:'1/1.3"',apertureMin:2.8,apertureMax:2.8,apertureFixed:true,isoBase:100,isoVideoMax:6400,isEstimate:true},
  autel_nano:{sensor:'1/1.28"',apertureMin:1.9,apertureMax:1.9,apertureFixed:true,isoBase:100,isoVideoMax:6400},
  autel_lite:{sensor:'1"',apertureMin:2.8,apertureMax:11,apertureFixed:false,isoBase:100,isoVideoMax:6400},
  potensic_atom_se:{sensor:'1/2"',apertureMin:2.2,apertureMax:2.2,apertureFixed:true,isoBase:100,isoVideoMax:3200,isEstimate:true},
  potensic_atom2:{sensor:'1/2"',apertureMin:1.8,apertureMax:1.8,apertureFixed:true,isoBase:100,isoVideoMax:3200},
  hoverair_x1:{sensor:'1/2"',apertureMin:2.2,apertureMax:2.2,apertureFixed:true,isoBase:100,isoVideoMax:3200,isEstimate:true},
  hoverair_x1pro:{sensor:'1/2"',apertureMin:1.8,apertureMax:1.8,apertureFixed:true,isoBase:100,isoVideoMax:3200,isEstimate:true},
  generic_light:{sensor:'1/2.3"',apertureMin:2.8,apertureMax:2.8,apertureFixed:true,isoBase:100,isoVideoMax:3200,isEstimate:true},
  generic_heavy:{sensor:'1/1.3"',apertureMin:1.7,apertureMax:1.7,apertureFixed:true,isoBase:100,isoVideoMax:6400,isEstimate:true},
};
function getDrone(){return DRONES[selectedDrone]||DRONES.mini4pro;}
function getDroneCamera(){return DRONE_CAMERA[selectedDrone]||DRONE_CAMERA.generic_heavy;}
function loadDrone(){try{var s=localStorage.getItem('dc_drone');if(s&&DRONES[s])selectedDrone=s;}catch(e){}var sel=document.getElementById('drone-sel');if(sel)sel.value=selectedDrone;updateDroneLimits();}
function saveDrone(){
  var sel=document.getElementById('drone-sel');
  if(!sel)return;
  if(sel.value==='__pro__'){
    openProOverlay();
    sel.value=selectedDrone||'mini4pro';
    return;
  }
  selectedDrone=sel.value;
  try{localStorage.setItem('dc_drone',selectedDrone);}catch(e){}
  updateDroneLimits();
  if(wxData){renderDash();renderFc();}
  renderFavBar();
  // Refresh threshold UI if Pro account screen is open
  var proSheet=document.getElementById('pro-sheet');
  var proOverlay=document.getElementById('pro-overlay');
  if(proSheet&&proOverlay&&proOverlay.style.display!=='none'&&isPro()){
    var thrSection=proSheet.querySelector('.threshold-section');
    if(thrSection)thrSection.outerHTML=buildThresholdUI();
  }
}
function updateDroneLimits(){
  var el=document.getElementById('drone-limits');
  if(!el)return;
  var limitText='Max sustained '+spd(getDrone().windRed)+' '+spdU();
  if(isPro()){
    var isCustom=hasCustomThresholds();
    el.innerHTML=limitText+'<span style="font-size:10px;margin-left:3px;opacity:.7;">'+(isCustom?'✎️':'✎️')+'</span>';
    el.style.color='var(--muted)';
    el.style.textDecoration='underline';
    el.style.textDecorationStyle='dotted';
    el.style.cursor='pointer';
    el.title='Adjust fly rating thresholds'+(isCustom?' (custom)':' ('+getDrone().name+' defaults)');
  } else {
    el.textContent=limitText;
    el.style.textDecoration='none';
    el.style.cursor='default';
    el.title='';
  }
}
function saveWxCache(data){try{localStorage.setItem('dc_wx',JSON.stringify({ts:Date.now(),data:data}));}catch(e){}}
function loadWxCache(){try{var s=localStorage.getItem('dc_wx');if(s)return JSON.parse(s);}catch(e){}return null;}
function saveLastLoc(lat,lng,name){try{localStorage.setItem('dc_lastloc',JSON.stringify({lat:lat,lng:lng,name:name}));}catch(e){}}
function loadLastLoc(){try{var s=localStorage.getItem('dc_lastloc');if(s)return JSON.parse(s);}catch(e){}return null;}
function showOfflineBanner(ts){var bar=document.getElementById('offline-bar'),age=document.getElementById('offline-age');if(!bar||!age)return;var m=Math.floor((Date.now()-ts)/60000);age.textContent='Last updated '+(m<1?'just now':m===1?'1 minute ago':m+' minutes ago');bar.style.display='flex';}
function hideOfflineBanner(){var bar=document.getElementById('offline-bar');if(bar)bar.style.display='none';}
var CHECKLIST=[
  {section:'Pilot & Registration'},{id:'reg',label:'Operator ID displayed on drone (required for drones 250g+ or 100g+ with camera)'},
  {id:'flyer',label:'Flyer ID carried or accessible (required for all drones 100g+)'},
  {id:'remoteid',label:'Remote ID switched on (mandatory for class-marked drones; recommended for all)'},
  {id:'greenlight',label:'Green flashing light fitted and active (required for all night flights)'},
  {id:'notam',label:'Checked CAA airspace restrictions and NOTAMs'},{id:'rules',label:'Airspace checked — no restrictions at location'},{id:'insure',label:'Insurance valid (if required)'},
  {section:'Drone Hardware'},{id:'props',label:'Propellers secure and undamaged'},{id:'arms',label:'Arms fully unfolded and locked'},
  {id:'gimbal',label:'Gimbal guard removed'},{id:'body',label:'Drone body free of damage or cracks'},{id:'lens',label:'Camera lens clean and clear'},
  {section:'Battery & Power'},{id:'batt',label:'Drone battery fully charged'},{id:'battlv',label:'Battery level above 80%'},
  {id:'battok',label:'Battery not swollen or damaged'},{id:'ctrlbat',label:'Controller battery charged'},
  {section:'Storage & Settings'},{id:'sd',label:'Memory card inserted and formatted'},{id:'sdspace',label:'Sufficient storage space available'},
  {id:'mode',label:'Flight mode set correctly (Normal/Cine)'},{id:'rth',label:'Return to Home altitude set (above obstacles)'},
  {section:'Environment & Safety'},{id:'weather',label:'Weather checked — wind within drone limits'},{id:'people',label:'Flying area clear of people and animals'},
  {id:'obs',label:'Checked for overhead obstacles and wires'},{id:'takeoff',label:'Safe, flat take-off and landing spot identified'},{id:'visual',label:'Drone will remain in visual line of sight'},
  {section:'Pre-Takeoff'},{id:'compass',label:'Compass calibrated (if in new location)'},{id:'gps',label:'GPS signal strong (6+ satellites)'},
  {id:'home',label:'Home point confirmed on controller'},{id:'hovtest',label:'Hover test completed at low altitude'},
];
var clState={};
function openChecklist(){
  var btn=document.getElementById('nb-cl');
  if(btn){goTab('cl',btn);}else{
    document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('on');});
    document.querySelectorAll('.nb').forEach(function(b){b.classList.remove('on');});
    var tabEl=document.getElementById('tab-cl');if(tabEl)tabEl.classList.add('on');
    renderChecklist();
  }
}
function openRules(){
  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('on');});
  document.querySelectorAll('.nb').forEach(function(b){b.classList.remove('on');});
  var tabEl=document.getElementById('tab-rules');if(tabEl)tabEl.classList.add('on');
  renderRules();
}
function getChecklistSummary(){
  var items=CHECKLIST.filter(function(i){return i.id;});
  var done=items.filter(function(i){return clState[i.id];}).length;
  var total=items.length;
  var pct=Math.round((done/total)*100);
  return{done:done,total:total,pct:pct};
}
function loadChecklist(){
  try{
    var s=localStorage.getItem('dc_checklist');
    if(s){
      var parsed=JSON.parse(s);
      var ts=parsed.ts||0;
      if(Date.now() - ts < 12*3600*1000){
        clState=parsed.state||{};
      } else {
        clState={};
        saveChecklist();
      }
    }
  }catch(e){}
}
function saveChecklist(){
  try{
    localStorage.setItem('dc_checklist',JSON.stringify({ts:Date.now(),state:clState}));
  }catch(e){}
}
function toggleCheck(id){
  clState[id]=!clState[id];saveChecklist();renderChecklist();
  updateChecklistDash();
}
function resetChecklist(){clState={};saveChecklist();renderChecklist();updateChecklistDash();}
// In-place update of the dashboard's Pre-flight Checklist summary — avoids a full
// renderDash() rebuild when only the checklist progress changed.
function updateChecklistDash(){
  var bar=document.getElementById('dash-cl-bar');
  var count=document.getElementById('dash-cl-count');
  var rem=document.getElementById('dash-cl-remaining');
  if(!bar&&!count&&!rem)return;
  var s=getChecklistSummary();
  if(bar)bar.style.width=s.pct+'%';
  if(count)count.textContent=s.done+' / '+s.total+' complete';
  if(rem){
    if(s.done===s.total){rem.textContent='✓ All done';rem.setAttribute('style','color:var(--green);');}
    else{rem.textContent=(s.total-s.done)+' remaining';rem.removeAttribute('style');}
  }
  if(typeof _lastDashSig!=='undefined'&&_lastDashSig!==null)_lastDashSig=_dashSignature();
}
function renderChecklist(){
  var items=CHECKLIST.filter(function(i){return i.id;}),done=items.filter(function(i){return clState[i.id];}).length,total=items.length,pct=Math.round((done/total)*100);
  var html='<div class="card"><h2 class="card-ttl">Pre-Flight Checklist</h2><div class="cl-progress"><div class="cl-progress-bar" style="width:'+pct+'%;"></div></div><div class="cl-count">'+done+' / '+total+' complete</div>'+(done===total?'<div class="cl-complete">&#x2705; All checks complete — safe flying!</div>':'');
  CHECKLIST.forEach(function(item){
    if(item.section){html+='<div class="cl-section-hdr">'+item.section+'</div>';}
    else{var c=!!clState[item.id];html+='<div class="cl-item" onclick="toggleCheck(\''+item.id+'\')"><div class="cl-box'+(c?' checked':'')+'"><svg class="cl-tick" viewBox="0 0 14 14"><polyline points="2,7 5.5,11 12,3"/></svg></div><span class="cl-label'+(c?' checked':'')+'">'+item.label+'</span></div>';}
  });
  html+='<button class="cl-reset" onclick="resetChecklist()">&#x21BA; Reset checklist</button></div><div style="height:14px;"></div>';
  document.getElementById('cl-body').innerHTML=html+proAccountCard();
}
function renderRules(){
  var html='<div class="card">'+
  '<h2 class="card-ttl">UK Drone Law — Rules &amp; 2026 Updates</h2>'+
  '<div class="rule"><div class="rule-ico">📏</div><div><div class="rule-ttl">Max altitude 120m (400ft)</div><div class="rule-body">Do not fly above 120m AGL without special authorisation.</div></div></div>'+
  '<div class="rule"><div class="rule-ico">👁️</div><div><div class="rule-ttl">Visual line of sight always</div><div class="rule-body">Keep your drone in sight at all times. Max ~500m recommended.</div></div></div>'+
  '<div class="rule"><div class="rule-ico">✈️</div><div><div class="rule-ttl">Stay clear of airport Flight Restriction Zones (FRZs)</div><div class="rule-body">FRZs vary in shape and extend several km around airports and airfields — they are not a simple 5km circle. Check the CAA Drone Assist app or airspace map before every flight.</div></div></div>'+
  '<div class="rule"><div class="rule-ico">🪪</div><div><div class="rule-ttl">CAA registration required</div><div class="rule-body">Drones 250g+ or 100g+ with a camera need an Operator ID ('+CAA_OPERATOR_FEE_NOTE+'). A free Flyer ID is required for drones 100g+. From January 2026 the threshold dropped from 250g to 100g — every sub-250g camera drone now requires both IDs displayed on the aircraft.</div></div></div>'+
  '<div class="rule"><div class="rule-ico">📡</div><div><div class="rule-ttl">Remote ID (from 1 Jan 2026)</div><div class="rule-body">UK1, UK2 and UK3 class-marked drones must broadcast Remote ID during every flight. Extends to UK0 camera drones (100g+), UK4 model aircraft and legacy aircraft from 1 Jan 2028. Remote ID broadcasts your Operator ID during flight.</div></div></div>'+
  '<div class="rule"><div class="rule-ico">🟢</div><div><div class="rule-ttl">Night flying — green flashing light mandatory</div><div class="rule-body">All Open Category drones must display a green flashing light at all times during night flights. Applies to all sizes including sub-250g. The light must not deactivate during flight — some drones switch lights off when recording.</div></div></div>'+
  '<div class="rule"><div class="rule-ico">🏢</div><div><div class="rule-ttl">400m no-fly zone around prisons</div><div class="rule-body">Flying within 400 metres of any closed prison or young offender institution is an automatic offence — no intent required. Smuggling contraband by drone carries up to 10 years imprisonment.</div></div></div>'+
  '<div style="background:var(--bg3);border-radius:var(--radius-sm);padding:10px 12px;margin-top:12px;font-size:12px;color:var(--muted);line-height:1.5;">⚠️ This is a summary guide only. Always check the latest official guidance at <a href=\"https://www.caa.co.uk/drones\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"color:var(--accent)\">caa.co.uk/drones</a> before flying.</div>'+
  '</div>'+
  '<div class="card" style="margin-bottom:0;">'+
  '<h2 class="card-ttl">Official Resources</h2>'+
  '<a href="https://www.caa.co.uk/drones" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;text-decoration:none;">'+
  '<div><div style="font-size:13px;font-weight:600;color:var(--text);">🪪 CAA Drone Safety</div><div style="font-size:12px;color:var(--muted);margin-top:2px;">Official UK rules, registration and guidance</div></div>'+
  '<span style="color:var(--accent);font-size:13px;font-weight:600;flex-shrink:0;">Open →</span></a>'+
  '</div><div style="height:14px;"></div>';
  document.getElementById('rules-body').innerHTML=html;
}
var _wxId=0;
function wxIcon(code,isNight){
  var id='wx'+(++_wxId);
  var SUN='#fbbf24',MOON='#fcd34d',CL='#94a3b8',CM='#64748b',CD='#475569',RN='#60a5fa',SN='#e2e8f0',IC='#bae6fd',LT='#fbbf24';
  function svg(b){return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="1em" height="1em" aria-hidden="true" overflow="visible" style="vertical-align:middle;flex-shrink:0">'+b+'</svg>';}
  function sunEl(cx,cy,r,col){
    col=col||SUN;
    var s='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+col+'"/>';
    var r1=r+3,r2=r1+5;
    [0,45,90,135,180,225,270,315].forEach(function(a){var rad=a*Math.PI/180,cs=Math.cos(rad),sn=Math.sin(rad);
      s+='<line x1="'+(cx+cs*r1).toFixed(1)+'" y1="'+(cy+sn*r1).toFixed(1)+'" x2="'+(cx+cs*r2).toFixed(1)+'" y2="'+(cy+sn*r2).toFixed(1)+'" stroke="'+col+'" stroke-width="2.5" stroke-linecap="round"/>';});
    return s;
  }
  function moonEl(cx,cy,r){
    var r2=Math.round(r*0.78),ox=Math.round(r*0.4),oy=Math.round(r*0.3);
    return '<defs><mask id="'+id+'"><rect width="48" height="48" fill="white"/><circle cx="'+(cx+ox)+'" cy="'+(cy-oy)+'" r="'+r2+'" fill="black"/></mask></defs>'+
           '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+MOON+'" mask="url(#'+id+')"/>';
  }
  function cloudEl(cx,cy,col,sc){
    sc=sc||1;
    return '<ellipse cx="'+(cx-Math.round(7*sc))+'" cy="'+(cy-Math.round(6*sc))+'" rx="'+Math.round(7*sc)+'" ry="'+Math.round(6.5*sc)+'" fill="'+col+'"/>'+
           '<ellipse cx="'+(cx+Math.round(5*sc))+'" cy="'+(cy-Math.round(9*sc))+'" rx="'+Math.round(9*sc)+'" ry="'+Math.round(8*sc)+'" fill="'+col+'"/>'+
           '<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+Math.round(13*sc)+'" ry="'+Math.round(7*sc)+'" fill="'+col+'"/>';
  }
  function rainEl(cx,cy,n,col){
    col=col||RN;var s='',sp=8,sx=cx-(n-1)*sp/2;
    for(var i=0;i<n;i++){var x=sx+i*sp;
      s+='<line x1="'+(x+1.5).toFixed(1)+'" y1="'+cy+'" x2="'+(x-1.5).toFixed(1)+'" y2="'+(cy+7)+'" stroke="'+col+'" stroke-width="2.2" stroke-linecap="round"/>';}
    return s;
  }
  function snowEl(cx,cy,n){
    var s='',sp=9,r=3.5,d=2.5,sx=cx-(n-1)*sp/2;
    for(var i=0;i<n;i++){var x=Math.round(sx+i*sp),y=cy+(i%2===1?3:0);
      s+='<line x1="'+(x-r)+'" y1="'+y+'" x2="'+(x+r)+'" y2="'+y+'" stroke="'+SN+'" stroke-width="1.8" stroke-linecap="round"/>'+
         '<line x1="'+x+'" y1="'+(y-r)+'" x2="'+x+'" y2="'+(y+r)+'" stroke="'+SN+'" stroke-width="1.8" stroke-linecap="round"/>'+
         '<line x1="'+(x-d)+'" y1="'+(y-d)+'" x2="'+(x+d)+'" y2="'+(y+d)+'" stroke="'+SN+'" stroke-width="1.8" stroke-linecap="round"/>'+
         '<line x1="'+(x+d)+'" y1="'+(y-d)+'" x2="'+(x-d)+'" y2="'+(y+d)+'" stroke="'+SN+'" stroke-width="1.8" stroke-linecap="round"/>';}
    return s;
  }
  function boltEl(cx,cy){return '<polygon points="'+(cx+3)+','+(cy)+' '+(cx-4)+','+(cy+9)+' '+cx+','+(cy+9)+' '+(cx-2)+','+(cy+17)+' '+(cx+7)+','+(cy+7)+' '+(cx+2)+','+(cy+7)+'" fill="'+LT+'"/>';}
  function fogEl(){var s='';[12,19,26,33,40].forEach(function(y,i){var x=i%2?10:6;s+='<line x1="'+x+'" y1="'+y+'" x2="'+(48-x)+'" y2="'+y+'" stroke="'+CL+'" stroke-width="3" stroke-linecap="round"/>';});return s;}
  switch(code){
    case 0:return svg(isNight?moonEl(24,24,12):sunEl(24,24,9));
    case 1:return svg(isNight?moonEl(30,15,9)+cloudEl(19,36,CL,0.65):sunEl(30,14,8)+cloudEl(20,36,CL,0.65));
    case 2:return svg(isNight?moonEl(31,14,10)+cloudEl(22,32,CL):sunEl(33,13,9)+cloudEl(22,32,CL));
    case 3:return svg(cloudEl(24,28,CM));
    case 45:case 48:return svg(fogEl());
    case 51:case 53:return svg(isNight?cloudEl(24,25,CM)+rainEl(24,33,2):sunEl(32,13,7)+cloudEl(21,25,CM)+rainEl(22,33,2));
    case 55:return svg(cloudEl(24,24,CM)+rainEl(24,32,3));
    case 56:case 57:return svg(cloudEl(24,24,CM)+rainEl(24,32,3,IC));
    case 61:return svg(isNight?cloudEl(24,25,CM)+rainEl(24,33,3):sunEl(32,13,7)+cloudEl(21,25,CM)+rainEl(22,33,3));
    case 63:return svg(cloudEl(24,24,CM)+rainEl(24,32,3));
    case 65:return svg(cloudEl(24,23,CD)+rainEl(24,31,4));
    case 66:case 67:return svg(cloudEl(24,24,CM)+rainEl(24,32,3,IC));
    case 71:case 73:case 75:case 77:return svg(cloudEl(24,24,CM)+snowEl(24,33,3));
    case 80:return svg(isNight?cloudEl(24,25,CM)+rainEl(24,33,2):sunEl(32,13,7)+cloudEl(21,25,CM)+rainEl(22,33,2));
    case 81:return svg(cloudEl(24,24,CD)+rainEl(24,32,3));
    case 82:return svg(cloudEl(24,23,CD)+rainEl(24,31,4));
    case 85:return svg(cloudEl(24,24,CM)+snowEl(24,32,2));
    case 86:return svg(cloudEl(24,23,CD)+snowEl(24,31,3));
    case 95:return svg(cloudEl(24,23,CD)+boltEl(21,28));
    case 96:case 99:return svg(cloudEl(24,23,CD)+boltEl(17,28)+boltEl(27,28));
    default:return svg('<text x="24" y="32" text-anchor="middle" font-size="22" fill="'+CL+'" font-family="sans-serif">?</text>');
  }
}
function wmoInfo(code,date){
  var now=date||new Date();
  var isNight=false;
  if(uLat&&uLng){
    var st=calcSunTimes(uLat,uLng,now);
    isNight=!!(st.sunrise&&st.sunset&&(now<st.sunrise||now>st.sunset));
  } else {
    var h=now.getHours();isNight=h<6||h>=21;
  }
  var descs={
    0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
    45:'Fog',48:'Icy fog',
    51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',
    56:'Light freezing drizzle',57:'Freezing drizzle',
    61:'Light rain',63:'Rain',65:'Heavy rain',
    66:'Light freezing rain',67:'Freezing rain',
    71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',
    80:'Light showers',81:'Showers',82:'Heavy showers',
    85:'Snow showers',86:'Heavy snow showers',
    95:'Thunderstorm',96:'Thunderstorm w/ hail',99:'Thunderstorm w/ heavy hail'
  };
  return {desc:descs[code]||'Unknown',emoji:wxIcon(code,isNight)};
}
function qualifyPrecipDesc(desc,precip){
  if(precip>=10)return desc;
  return desc.replace(/\b(Thunderstorm|Heavy precipitation|Freezing precipitation|Heavy drizzle|Drizzle|Light rain|Rain|Light snow|Snow)\b/g,function(m){return'Potential '+m.charAt(0).toLowerCase()+m.slice(1);});
}
function precipAdjustWmo(wmo,precip){
  if(precip==null)return wmo;
  if(wmo<=3){
    if(precip>=70) return 63;
    if(precip>=50) return 61;
  }
  else if((wmo===51||wmo===53||wmo===61||wmo===71||wmo===77||wmo===80||wmo===85)&&precip<50){
    return 3;
  }
  return wmo;
}
function fcRating(wind,gust,vis,wmo,precip,temp,kp,wind80,wind120){
  wmo=precipAdjustWmo(wmo||0,precip);
  return flyRating(
    wind||0, gust||0, (vis==null?10000:vis), wmo,
    (kp==null?currentKp:kp),
    (temp==null?15:temp),
    wind80||0, wind120||0
  ).lvl;
}
function dirLabel(deg){return['N','NE','E','SE','S','SW','W','NW'][Math.round(deg/45)%8];}
function pad(n){return(n<10?'0':'')+n;}
function fmtTime(d){return pad(d.getHours())+':'+pad(d.getMinutes());}
// Convert a location-local time string from Open-Meteo to actual UTC ms for comparisons
function locEntryMs(ts){return new Date(ts+'Z').getTime()-wxLocUtcOffsetMs;}
var DRONE_SVG='<svg width="32" height="32" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#0f172a"/><circle cx="50" cy="50" r="32" fill="none" stroke="#38bdf8" stroke-width="3.5"/><line x1="50" y1="50" x2="21" y2="21" stroke="white" stroke-width="9" stroke-linecap="round"/><line x1="50" y1="50" x2="79" y2="21" stroke="white" stroke-width="9" stroke-linecap="round"/><line x1="50" y1="50" x2="21" y2="79" stroke="white" stroke-width="9" stroke-linecap="round"/><line x1="50" y1="50" x2="79" y2="79" stroke="white" stroke-width="9" stroke-linecap="round"/><circle cx="21" cy="21" r="13" fill="none" stroke="#38bdf8" stroke-width="4"/><circle cx="79" cy="21" r="13" fill="none" stroke="#38bdf8" stroke-width="4"/><circle cx="21" cy="79" r="13" fill="none" stroke="#38bdf8" stroke-width="4"/><circle cx="79" cy="79" r="13" fill="none" stroke="#38bdf8" stroke-width="4"/><rect x="14" y="18" width="14" height="6" rx="2" fill="white" transform="rotate(-45 21 21)"/><rect x="72" y="18" width="14" height="6" rx="2" fill="white" transform="rotate(45 79 21)"/><rect x="14" y="76" width="14" height="6" rx="2" fill="white" transform="rotate(45 21 79)"/><rect x="72" y="76" width="14" height="6" rx="2" fill="white" transform="rotate(-45 79 79)"/><circle cx="50" cy="50" r="11" fill="white"/><circle cx="50" cy="50" r="5.5" fill="#0f172a"/></svg>';
function loadUnits(){
  try{var s=localStorage.getItem('dc_units');if(s==='imperial')unitMode='mph';else if(s==='ms')unitMode='ms';else if(s==='kts')unitMode='kts';else unitMode='kmh';}catch(e){}
  try{tempMode=localStorage.getItem('dc_temp_unit')||'c';}catch(e){}
  updateUnitToggle();
}
function saveUnits(){
  try{localStorage.setItem('dc_units',unitMode==='mph'?'imperial':unitMode==='ms'?'ms':unitMode==='kts'?'kts':'metric');}catch(e){}
  try{localStorage.setItem('dc_temp_unit',tempMode);}catch(e){}
}
function toggleUnits(){unitMode=unitMode==='kmh'?'mph':unitMode==='mph'?'ms':'kmh';saveUnits();updateUnitToggle();updateDroneLimits();if(wxData){refreshDashCards();renderFc();if(document.getElementById('tab-radar').classList.contains('on'))initWindMap();}}
function updateUnitToggle(){var btn=document.getElementById('unit-toggle');if(!btn)return;var current={kmh:'km/h',mph:'mph',ms:'m/s'};var next={kmh:'mph',mph:'m/s',ms:'km/h'};btn.textContent=current[unitMode]+' → '+next[unitMode];btn.setAttribute('aria-label','Currently '+current[unitMode]+'. Tap to switch to '+next[unitMode]);btn.title='Switch to '+next[unitMode];}
function spd(v){if(unitMode==='mph')return Math.round(v*0.621);if(unitMode==='ms')return parseFloat((v/3.6).toFixed(1));if(unitMode==='kts')return parseFloat((v*0.539957).toFixed(1));return Math.round(v);}
function spdU(){return unitMode==='mph'?'mph':unitMode==='ms'?'m/s':unitMode==='kts'?'kt':'km/h';}
function tmp(v){return tempMode==='f'?Math.round(v*9/5+32):Math.round(v);}
function tmpU(){return tempMode==='f'?'°F':'°C';}
function visDisp(v){if(unitMode==='mph'){if(v>=1609)return{val:(v/1609.34).toFixed(1),unit:'mi'};return{val:Math.round(v*3.281),unit:'ft'};}if(v>=1000)return{val:(v/1000).toFixed(0),unit:'km'};return{val:v,unit:'m'};}
function buildFeedbackMailto(){
  var info=[];
  info.push('App version: v'+APP_VERSION);
  info.push('Device: '+(navigator.userAgent||'unknown'));
  info.push('Platform: '+(isIOS?'iOS':isAndroid?'Android':'Web'));
  info.push('Standalone (installed): '+(isStandalone?'yes':'no'));
  info.push('Location: '+((document.getElementById('loc-name')||{}).textContent||'unknown'));
  info.push('Drone: '+getDrone().name);
  info.push('Units: '+unitMode);
  info.push('Date: '+new Date().toISOString());
  var body='\n\n---\nPlease describe the issue above this line.\n\nDiagnostics (helps with debugging):\n'+info.join('\n');
  return 'mailto:bbridgewater.dev@gmail.com?subject='+encodeURIComponent('DroneChecker Feedback')+'&body='+encodeURIComponent(body);
}
function resetAllData(){
  if(!confirm('Reset all DroneChecker data on this device?\n\nThis will delete:\n• Your drone profile and unit preference\n• Saved favourite locations\n• Flight log entries\n• Pre-flight checklist progress\n• Disclaimer and onboarding state\n• Cached weather data\n\nThe page will then reload. This cannot be undone.'))return;
  try{
    var keys=['dc_drone','dc_units','dc_checklist','dc_disclaimer','dc_analytics_consent','dc_onboarded','dc_favs','dc_flights','dc_wx','dc_lastloc'];
    keys.forEach(function(k){try{localStorage.removeItem(k);}catch(e){}});
  }catch(e){}
  if('caches' in window){
    caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k);});}).finally(function(){location.reload();});
  } else {
    location.reload();
  }
}
function showProWelcomeScreen(){
  var el=document.createElement('div');
  el.id='pro-welcome-screen';
  el.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.97);z-index:10002;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:32px;text-align:center;';
  function _dismissWelcome(){
    el.style.transition='opacity .3s';el.style.opacity='0';
    setTimeout(function(){if(el.parentNode)el.remove();closeProOverlay();},300);
  }
  el.innerHTML=
    '<div style="position:relative;width:72px;height:72px;border-radius:20px;background:#0f172a;border:2px solid rgba(245,158,11,.4);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px rgba(245,158,11,.08);">'+
    '<svg width="44" height="44" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#0f172a"/><rect width="100" height="100" rx="20" fill="none" stroke="#f59e0b" stroke-width="4"/><circle cx="50" cy="50" r="32" fill="none" stroke="#38bdf8" stroke-width="3.5"/><line x1="50" y1="50" x2="21" y2="21" stroke="white" stroke-width="9" stroke-linecap="round"/><line x1="50" y1="50" x2="79" y2="21" stroke="white" stroke-width="9" stroke-linecap="round"/><line x1="50" y1="50" x2="21" y2="79" stroke="white" stroke-width="9" stroke-linecap="round"/><line x1="50" y1="50" x2="79" y2="79" stroke="white" stroke-width="9" stroke-linecap="round"/><circle cx="21" cy="21" r="13" fill="none" stroke="#38bdf8" stroke-width="4"/><circle cx="79" cy="21" r="13" fill="none" stroke="#38bdf8" stroke-width="4"/><circle cx="21" cy="79" r="13" fill="none" stroke="#38bdf8" stroke-width="4"/><circle cx="79" cy="79" r="13" fill="none" stroke="#38bdf8" stroke-width="4"/><rect x="14" y="18" width="14" height="6" rx="2" fill="white" transform="rotate(-45 21 21)"/><rect x="72" y="18" width="14" height="6" rx="2" fill="white" transform="rotate(45 79 21)"/><rect x="14" y="76" width="14" height="6" rx="2" fill="white" transform="rotate(45 21 79)"/><rect x="72" y="76" width="14" height="6" rx="2" fill="white" transform="rotate(-45 79 79)"/><circle cx="50" cy="50" r="11" fill="white"/><circle cx="50" cy="50" r="5.5" fill="#0f172a"/></svg>'+
    '<div style="position:absolute;bottom:-6px;right:-6px;width:22px;height:22px;border-radius:50%;background:#f59e0b;border:2px solid #0f172a;display:flex;align-items:center;justify-content:center;"><svg width="12" height="12" viewBox="0 0 24 24" fill="#000"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div>'+
    '</div>'+
    '<div style="font-size:24px;font-weight:700;color:#fff;letter-spacing:-.5px;">Welcome to Pro!</div>'+
    '<div style="font-size:15px;color:#94a3b8;max-width:300px;line-height:1.7;">72-hour forecast, golden hour tab, restrictions map and flight log are now all yours.</div>'+
    '<button id="pro-welcome-btn" style="background:#f59e0b;border:none;border-radius:12px;padding:14px 40px;font-size:16px;font-weight:700;color:#000;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">Start exploring →</button>'+
    '<div style="font-size:12px;color:#475569;">Tap anywhere to dismiss</div>';
  el.addEventListener('click',function(e){if(e.target===el)_dismissWelcome();});
  setTimeout(function(){var b=document.getElementById('pro-welcome-btn');if(b)b.addEventListener('click',function(e){e.stopPropagation();_dismissWelcome();});},0);
  document.body.appendChild(el);
  setTimeout(function(){
    el.style.transition='opacity .5s';el.style.opacity='0';
    setTimeout(function(){if(el.parentNode)el.remove();},500);
  },10000);
}
function showToast(msg,duration){
  var old=document.querySelector('.toast');if(old)old.remove();
  var t=document.createElement('div');t.className='toast';t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(function(){t.style.opacity='0';setTimeout(function(){if(t.parentNode)t.remove();},300);},duration||2200);
}
var _refreshing=false;
function manualRefresh(){
  if(_refreshing)return;
  _refreshing=true;
  var btn=document.getElementById('refresh-btn');
  if(btn){btn.textContent='↻ Refreshing...';btn.style.opacity='0.6';}
  showToast('Refreshing weather...');
  // Force fresh GPS fix (maximumAge:0) — user may have moved since last fix
  getLoc(true);
  setTimeout(function(){
    if(btn){btn.textContent='↻ Refresh';btn.style.opacity='1';}
    _refreshing=false;
  },3000);
}
function useMyLocation(){
  document.getElementById('loc-inp').value='';
  document.getElementById('serr').style.display='none';
  document.getElementById('dash').innerHTML='<div class="skel skel-cond"></div><div class="skel skel-card"></div>';
  showToast('Finding your location...');
  if(!navigator.geolocation){
    showToast('Location not supported');
    // Restore dashboard if we had data, otherwise fetch at last known coords
    if(wxData){renderDash();renderFc();renderGolden();initMoreConditions();}
    else if(uLat&&uLng){fetchAll();}
    return;
  }
  navigator.geolocation.getCurrentPosition(
    function(p){
      uLat=p.coords.latitude;uLng=p.coords.longitude;
      // Let revGeo resolve the real name — don't pre-set "Your Location"
      revGeo();fetchAll();
    },
    function(err){
      // GPS failed — fall back to cached last location silently if available
      var lastLoc=loadLastLoc();
      if(lastLoc){
        uLat=lastLoc.lat;uLng=lastLoc.lng;
        var locEl=document.getElementById('loc-name');
        if(locEl)locEl.textContent=lastLoc.name;
        fetchAll();
      } else if(wxData){
        // No cached location but have weather data — restore dashboard as-is
        renderDash();renderFc();renderGolden();
        showToast('Could not get location — try searching a postcode');
      } else if(uLat&&uLng){
        // Have coords from startup — fetch weather at those
        fetchAll();
      } else {
        // Nothing at all — show error
        document.getElementById('dash').innerHTML='';
        showToast('Could not get location — try searching a postcode');
      }
    },
    {timeout:12000,maximumAge:0}
  );
}
function loadFavs(){try{return JSON.parse(localStorage.getItem('dc_favs'))||[];}catch(e){return[];}}
function saveFavs(favs){try{localStorage.setItem('dc_favs',JSON.stringify(favs));}catch(e){}saveFavsToCloud(favs);}
function saveFavsToCloud(favs){
  if(!proUser||!proUser.uid||!_fbLoaded)return;
  var db=firebase.firestore();
  db.collection('users').doc(proUser.uid).set({savedLocations:favs},{merge:true}).catch(function(){});
}
function syncFavsFromCloud(uid,callback){
  if(!_fbLoaded||!uid){if(callback)callback();return;}
  try{
    var db=firebase.firestore();
    db.collection('users').doc(uid).get().then(function(snap){
      if(snap.exists&&snap.data().savedLocations){
        var cloud=snap.data().savedLocations;
        var local=loadFavs();
        var merged=cloud.slice();
        local.forEach(function(f){if(!merged.some(function(c){return c.name===f.name;})){merged.push(f);}});
        try{localStorage.setItem('dc_favs',JSON.stringify(merged));}catch(e){}
        renderFavBar();
      }
      if(callback)callback();
    }).catch(function(e){
      console.error('[DC] syncFavsFromCloud error:',e);
      if(callback)callback();
    });
  }catch(e){
    console.error('[DC] syncFavsFromCloud error:',e);
    if(callback)callback();
  }
}
function toggleFavCurrent(){
  if(!uLat||!uLng)return;
  var name=document.getElementById('loc-name').textContent;
  if(name==='Locating...'||name==='London (default)'||name==='Your Location')return;
  var favs=loadFavs();
  var idx=favs.findIndex(function(f){return f.name===name;});
  if(idx>=0){
    favs.splice(idx,1);showToast('Removed from favourites');
  } else {
    var maxFavs=isPro()?999:2;
    if(favs.length>=maxFavs){if(!isPro()){showToast('Max 2 locations - Go Pro for unlimited');openProOverlay();}return;}
    favs.push({name:name,lat:uLat,lng:uLng});
    showToast('⭐ '+name+' saved');
  }
  saveFavs(favs);renderFavBar();
}
function renderFavBar(){
  var favs=loadFavs();
  var bar=document.getElementById('fav-bar');
  var btn=document.getElementById('fav-btn');
  if(!bar||!btn)return;
  var curName=document.getElementById('loc-name').textContent;
  var isFav=favs.some(function(f){return f.name===curName;});
  btn.textContent=isFav?'\u2605':'\u2606';
  btn.style.color=isFav?'var(--amber)':'var(--muted)';
  btn.setAttribute('aria-label', isFav?'Remove from favourites':'Save as favourite');
  if(!favs.length){bar.classList.remove('show');return;}
  bar.classList.add('show');
  bar.innerHTML='<span class="fav-lbl">Saved:</span>';
  favs.forEach(function(f){
    var active=f.name===curName;
    var dot='';
    var tempStr='';
    if(isPro()){
      try{
        var cached=localStorage.getItem('dc_wx_fav_'+encodeURIComponent(f.name));
        if(cached){
          var d=JSON.parse(cached);
          if(d&&d.data&&d.data.current){
            var cur=d.data.current;
            var wind=cur.wind_speed_10m||0;
            var gust=cur.wind_gusts_10m||0;
            var vis=cur.visibility!=null?cur.visibility:10000;
            var wmo=cur.weather_code||0;
            var tmpC=cur.temperature_2m!=null?cur.temperature_2m:15;
            var r=fcRating(wind,gust,vis,wmo,null,tmpC,currentKp,0,0);
            var dotCol=r==='green'?'var(--green)':r==='amber'?'var(--amber)':'var(--red)';
            dot='<span style="width:8px;height:8px;border-radius:50%;background:'+dotCol+';border:1.5px solid #fff;display:inline-block;margin-right:4px;flex-shrink:0;"></span>';
            tempStr='<span style="font-size:10px;color:'+(active?'rgba(2,6,23,.65)':'var(--muted)')+';margin-left:4px;">'+Math.round(tmpC)+'\u00b0</span>';
          }
        }
      }catch(e){}
    }
    var b=document.createElement('button');
    b.className='fav-pill'+(active?' active':'');
    if(isPro())b.style.cssText='display:flex;align-items:center;';
    b.innerHTML=dot+esc(f.name)+tempStr;
    b.addEventListener('click',(function(name,lat,lng){return function(){loadFav(name,lat,lng);};})(f.name,f.lat,f.lng));
    bar.appendChild(b);
  });
  if(!isPro()){
    var cap=document.createElement('span');
    cap.className='fav-lbl';
    cap.style.marginLeft='auto';
    cap.textContent=favs.length+'/2 saved';
    bar.appendChild(cap);
  }
}
function loadFav(name,lat,lng){
  uLat=lat;uLng=lng;
  document.getElementById('loc-name').textContent=decodeURIComponent(name);
  renderFavBar();fetchAll();
}
function dayHourlyRating(date){
  if(!wxData||!wxData.hourly)return null;
  var hours=wxData.hourly,target=date.toDateString(),green=0,amber=0,red=0;
  for(var i=0;i<hours.time.length;i++){
    var t=new Date(hours.time[i]);
    if(t.toDateString()!==target)continue;
    var wind=hours.wind_speed_10m[i]||0,gust=hours.wind_gusts_10m?hours.wind_gusts_10m[i]||0:0;
    var vis=hours.visibility?hours.visibility[i]||10000:10000;
    var wmo=hours.weather_code?hours.weather_code[i]||0:0;
    var tp=hours.temperature_2m?hours.temperature_2m[i]||15:15;
    var w80=hours.wind_speed_80m?hours.wind_speed_80m[i]||0:0;
    var w120=hours.wind_speed_120m?hours.wind_speed_120m[i]||0:0;
    var precip=hours.precipitation_probability?Math.round(hours.precipitation_probability[i]||0):0;
    var lvl=flyRating(wind,gust,vis,precipAdjustWmo(wmo,precip),getKpForTime(t),tp,w80,w120).lvl;
    if(lvl==='green')green++;else if(lvl==='amber')amber++;else red++;
  }
  var total=green+amber+red;
  if(!total)return null;
  if(red>0)return'red';
  return green>=Math.floor(total*.6)?'green':'amber';
}
function renderWeekPlanner(daily){
  if(!daily||!daily.time)return'';
  var maxDays=isPro()?7:3;
  var bestIdx=1,bestScore=-1;
  for(var i=1;i<daily.time.length&&i<=maxDays;i++){
    var dMidT=((daily.temperature_2m_max[i]||15)+(daily.temperature_2m_min[i]||15))/2;
    var dayNoon1=new Date(daily.time[i]);dayNoon1.setHours(12,0,0,0);var r=dayHourlyRating(dayNoon1)||fcRating(daily.wind_speed_10m_max[i]||0,daily.wind_gusts_10m_max[i]||0,10000,daily.weather_code[i],null,dMidT,getKpForTime(dayNoon1),0,0);
    var score=r==='green'?2:r==='amber'?1:0;
    var gust=daily.wind_gusts_10m_max[i]||0;
    if(score>bestScore||(score===bestScore&&gust<(daily.wind_gusts_10m_max[bestIdx]||999))){bestScore=score;bestIdx=i;}
  }
  var rows='';
  for(var j=1;j<daily.time.length&&j<=maxDays;j++){
    var date=new Date(daily.time[j]);
    var dayLbl=date.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
    var dWmo=daily.weather_code[j],dInfo=wmoInfo(dWmo);
    var dMax=Math.round(daily.temperature_2m_max[j]),dMin=Math.round(daily.temperature_2m_min[j]);
    var dWind=spd(daily.wind_speed_10m_max[j]||0),dGust=spd(daily.wind_gusts_10m_max[j]||0);
    var dMidT2=((daily.temperature_2m_max[j]||15)+(daily.temperature_2m_min[j]||15))/2;
    var dayNoon2=new Date(daily.time[j]);dayNoon2.setHours(12,0,0,0);var dr=dayHourlyRating(dayNoon2)||fcRating(daily.wind_speed_10m_max[j]||0,daily.wind_gusts_10m_max[j]||0,10000,dWmo,null,dMidT2,getKpForTime(dayNoon2),0,0);
    var dotCls=dr==='green'?'g':dr==='amber'?'a':'r';
    var isBest=j===bestIdx;
    rows+='<div class="week-row'+(isBest?' best-day':'')+'">'+
      '<div class="week-day">'+dayLbl.split(' ')[0]+'<div style="font-size:11px;color:var(--muted);font-weight:400;">'+dayLbl.split(' ').slice(1).join(' ')+'</div></div>'+
      '<div class="week-emoji">'+dInfo.emoji+'</div>'+
      '<div class="week-info">'+dMin+'–'+dMax+'°C · '+Math.round(dMin*9/5+32)+'–'+Math.round(dMax*9/5+32)+'°F<div style="color:var(--muted);">'+dInfo.desc+'</div></div>'+
      '<div class="week-wind">'+dWind+' '+spdU()+'<div style="font-size:11px;">gust '+dGust+'</div></div>'+
      '<div class="week-dot '+dotCls+'"></div>'+
      (isBest?'<div style="font-size:11px;font-weight:600;color:var(--green);flex-shrink:0;">BEST</div>':'')+'</div>';
  }
  var weekTitle='Best Day to Fly — Next '+(isPro()?'7':'3')+' Days'+(isPro()?'':' <span style="font-size:10px;font-weight:400;color:var(--muted);">· 7 days with Pro</span>');
  return'<div class="week-card"><h2 class="card-ttl">'+weekTitle+'</h2>'+rows+'</div>';
}
function getFlightKey(){return(proUser&&proUser.uid)?'dc_flights_'+proUser.uid:'dc_flights';}

function loadFlights(){
  try{
    var key=getFlightKey();
    var data=localStorage.getItem(key);
    // One-time migration: if no UID-scoped data yet, fall back to legacy key
    if(!data&&key!=='dc_flights'){data=localStorage.getItem('dc_flights');}
    return JSON.parse(data)||[];
  }catch(e){return[];}
}

function saveFlights(f){
  try{localStorage.setItem(getFlightKey(),JSON.stringify(f));}catch(e){}
  if(isPro()&&proUser&&proUser.uid&&_fbLoaded){
    try{
      var db=firebase.firestore();
      db.collection('users').doc(proUser.uid).set(
        {flights:f,flightsUpdated:firebase.firestore.FieldValue.serverTimestamp()},
        {merge:true}
      ).catch(function(e){console.error('[DC] Firestore saveFlights error:',e);});
    }catch(e){console.error('[DC] saveFlights cloud error:',e);}
  }
}

function syncFlightsFromCloud(uid,callback){
  if(!_fbLoaded||!uid){if(callback)callback();return;}
  // Show syncing indicator if log tab is visible
  var syncEl=document.getElementById('log-sync-status');
  if(syncEl)syncEl.textContent='☁️ Syncing...';
  try{
    var db=firebase.firestore();
    db.collection('users').doc(uid).get().then(function(snap){
      if(snap.exists&&snap.data().flights&&snap.data().flights.length){
        var cloudFlights=snap.data().flights;
        var localFlights=loadFlights();
        var seen={};
        var merged=[];
        cloudFlights.concat(localFlights).forEach(function(f){
          var key=(f.date||'')+'|'+(f.loc||'')+'|'+(f.drone||'')+'|'+(f.dur||'');
          if(!seen[key]){seen[key]=true;merged.push(f);}
        });
        merged.sort(function(a,b){return(b.date||'').localeCompare(a.date||'');});
        saveFlights(merged);
        _lastCloudSync=new Date();
        showToast('☁️ Flight log synced');
        renderLog();
      } else if(loadFlights().length){
        // Nothing in cloud — push local flights up
        saveFlights(loadFlights());
        _lastCloudSync=new Date();
      } else {
        _lastCloudSync=new Date();
      }
      var syncEl2=document.getElementById('log-sync-status');
      if(syncEl2)syncEl2.textContent='☁️ Synced just now';
      if(callback)callback();
    }).catch(function(e){
      console.error('[DC] syncFlightsFromCloud error:',e);
      var syncEl2=document.getElementById('log-sync-status');
      if(syncEl2)syncEl2.textContent='⚠️ Sync failed';
      if(callback)callback();
    });
  }catch(e){
    console.error('[DC] syncFlightsFromCloud error:',e);
    var syncEl2=document.getElementById('log-sync-status');
    if(syncEl2)syncEl2.textContent='⚠️ Sync failed';
    if(callback)callback();
  }
}
function manualSyncFlights(){
  if(!isPro()||!proUser||!proUser.uid){showToast('Sign in to sync your flights');return;}
  var syncEl=document.getElementById('log-sync-status');
  if(syncEl)syncEl.textContent='☁️ Syncing...';
  if(_fbLoaded){
    syncFlightsFromCloud(proUser.uid,function(){renderLog();});
  } else {
    loadFirebase(function(){
      syncFlightsFromCloud(proUser.uid,function(){renderLog();});
    });
  }
}

function renderLog(){
  var flights=loadFlights();
  var loc=document.getElementById('loc-name')?document.getElementById('loc-name').textContent:'';
  if(loc==='Locating...')loc='';
  var today=new Date().toISOString().split('T')[0];
  var drone=getDrone().name;
  var autoCond='Good to Fly';
  var autoWind='',autoTemp='',autoVis='',autoWxSummary='';
  if(wxData&&wxData.current){var c=wxData.current;var r=flyRating(c.wind_speed_10m||0,c.wind_gusts_10m||0,c.visibility||10000,c.weather_code||0,currentKp,c.temperature_2m||15,c.wind_speed_80m||0,c.wind_speed_120m||0);autoCond=r.label;
    autoWind=spd(c.wind_speed_10m||0)+' '+spdU();
    autoTemp=Math.round(c.temperature_2m||0)+'°C';
    var vd=visDisp(c.visibility||10000);autoVis=vd.val+' '+vd.unit;
    autoWxSummary=autoWind+' · '+autoTemp+' · 👁 '+autoVis;
  }
  var totalFlights=flights.length;
  var totalMins=flights.reduce(function(s,f){return s+(parseInt(f.dur)||0);},0);
  var totalHrs=Math.floor(totalMins/60),remMins=totalMins%60;
  var timeStr=totalHrs>0?totalHrs+'h '+remMins+'m':totalMins+'m';
  var thisMonth=flights.filter(function(f){var d=new Date(f.date);var n=new Date();return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear();}).length;
  var syncStatus=_lastCloudSync?'☁️ Synced '+timeSince(_lastCloudSync):'☁️ Not yet synced';
  var syncBar=isPro()
    ? '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 12px;background:rgba(245,158,11,.05);border-bottom:1px solid rgba(245,158,11,.1);">'+
      '<span id="log-sync-status" style="font-size:11px;color:var(--muted);">'+syncStatus+'</span>'+
      '<button onclick="manualSyncFlights()" style="background:none;border:none;font-size:11px;color:var(--accent);cursor:pointer;font-family:inherit;padding:0;font-weight:600;">Sync now</button>'+
      '</div>'
    : '';
  var stats=syncBar+'<div class="log-stats">'+
    '<div class="log-stat-tile"><div class="log-stat-val">'+totalFlights+'</div><div class="log-stat-lbl">Flights</div></div>'+
    '<div class="log-stat-tile"><div class="log-stat-val">'+(totalFlights?timeStr:'—')+'</div><div class="log-stat-lbl">Total time</div></div>'+
    '<div class="log-stat-tile"><div class="log-stat-val">'+thisMonth+'</div><div class="log-stat-lbl">This month</div></div>'+
    '</div>'+renderFlightStats(flights);
  var form='<div class="log-form">'+
    '<h2 class="card-ttl" style="margin-bottom:12px;">Log a Flight</h2>'+
    '<div class="log-2col">'+
    '<div class="log-field"><div class="log-field-lbl">Date</div><input class="log-input" id="li-date" type="date" value="'+today+'"/></div>'+
    '<div class="log-field"><div class="log-field-lbl">Duration (mins)</div><input class="log-input" id="li-dur" type="number" min="1" max="999" placeholder="e.g. 25"/></div>'+
    '</div>'+
    '<div class="log-field-lbl">Location</div>'+
    '<input class="log-input" id="li-loc" type="text" value="'+esc(loc)+'" placeholder="Where did you fly?"/>'+
    '<div class="log-2col">'+
    '<div class="log-field"><div class="log-field-lbl">Drone</div>'+
    '<input class="log-input" id="li-drone" type="text" value="'+esc(drone)+'" placeholder="Drone model"/></div>'+
    '<div class="log-field"><div class="log-field-lbl">Flight type</div>'+
    '<select class="log-input" id="li-type"><option>Recreation</option><option>Commercial</option><option>Training</option><option>Survey</option><option>Photography</option></select></div>'+
    '</div>'+
    '<div class="log-field-lbl">Conditions</div>'+
    '<select class="log-input" id="li-cond">'+
    '<option'+(autoCond==='✓ Good to Fly'||autoCond==='Good to Fly'?' selected':'')+'>Good to Fly</option>'+
    '<option'+(autoCond==='⚠ Fly with Caution'||autoCond==='Fly with Caution'?' selected':'')+'>Fly with Caution</option>'+
    '<option'+(autoCond==='✕ Do Not Fly'||autoCond==='Do Not Fly'?' selected':'')+'>Do Not Fly</option>'+
    '</select>'+
    (autoWxSummary?'<div style="background:var(--bg3);border-radius:var(--radius-sm);padding:8px 10px;font-size:12px;color:var(--muted);margin-bottom:10px;">💨 '+esc(autoWxSummary)+'<input type="hidden" id="li-wxwind" value="'+esc(autoWind)+'"/><input type="hidden" id="li-wxtemp" value="'+esc(autoTemp)+'"/><input type="hidden" id="li-wxvis" value="'+esc(autoVis)+'"/></div>':'')+
    '<div class="log-field-lbl">Notes (optional)</div>'+
    '<input class="log-input" id="li-notes" type="text" placeholder="Anything worth recording..."/>'+
    '<button class="log-btn" onclick="addFlight()">✈️ Save Flight</button>'+
    '</div>';
  var entries='';
  if(!flights.length){
    entries='<div class="log-empty"><div class="log-empty-icon">✈️</div>No flights logged yet.<br>Add your first flight above.</div>';
  } else {
    var condColor={'Good to Fly':'green','Fly with Caution':'amber','Do Not Fly':'red'};
    entries='<div class="log-count">'+flights.length+' flight'+(flights.length!==1?'s':'')+' logged</div>';
    var exportBtns=isPro()
      ? '<button class="log-export-btn" onclick="exportXlsx()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>Excel</button>'+
        '<button class="log-export-btn" onclick="exportGoogleSheets()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Sheets</button>'
      : '<button class="log-export-btn" onclick="openProOverlay()" style="opacity:.55;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>Excel <span style="font-size:9px;color:#f59e0b;margin-left:2px;">PRO</span></button>'+
        '<button class="log-export-btn" onclick="openProOverlay()" style="opacity:.55;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h8.5M14 2l5.5 5.5M14 2v5.5h5.5M20 13v6a2 2 0 01-2 2H6"/></svg>Sheets <span style="font-size:9px;color:#f59e0b;margin-left:2px;">PRO</span></button>';
    var backupBtns='<div class="log-backup-row">'+
      (isPro()
        ? '<button class="log-export-btn" onclick="backupLog()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Backup data</button>'+
          '<button class="log-export-btn" onclick="document.getElementById(\'restore-input\').click()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Restore</button>'+
          '<input type="file" id="restore-input" accept=".json" style="display:none;" onchange="restoreLog(this)"/>'
        : '<button class="log-export-btn" onclick="openProOverlay()" style="opacity:.55;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Backup data <span style="font-size:9px;color:#f59e0b;margin-left:2px;">PRO</span></button>'+
          '<button class="log-export-btn" onclick="openProOverlay()" style="opacity:.55;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Restore <span style="font-size:9px;color:#f59e0b;margin-left:2px;">PRO</span></button>'
      )+
    '</div>';
    entries+='<div class="log-actions">'+exportBtns+'<button class="log-clear" onclick="clearFlights()">Clear all</button></div>'+backupBtns;
    // Sort by timestamp descending (newest first)
    var sorted=flights.slice().sort(function(a,b){
      var ta=a.ts?new Date(a.ts):new Date(a.date);
      var tb=b.ts?new Date(b.ts):new Date(b.date);
      return tb-ta;
    });
    for(var i=0;i<sorted.length;i++){
      var f=sorted[i];
      var origIdx=flights.indexOf(f);
      var timeStr='';
      if(f.ts){var td=new Date(f.ts);timeStr=' · '+pad(td.getHours())+':'+pad(td.getMinutes());}
      var cc=condColor[f.cond]||'';
      entries+='<div class="log-entry">'+
        '<div class="log-entry-hdr">'+
        '<div><div class="log-entry-loc">'+esc(f.loc)+'</div></div>'+
        '<div style="display:flex;align-items:center;gap:8px;">'+
        '<div class="log-entry-date">'+esc(f.date)+timeStr+'</div>'+
        '<button class="log-entry-del" onclick="deleteFlight('+origIdx+')" title="Delete" aria-label="Delete flight entry">×</button>'+
        '</div></div>'+
        '<div class="log-entry-tags">'+
        '<span class="log-tag">🚁 '+esc(f.drone)+'</span>'+
        (f.dur?'<span class="log-tag">⏱ '+esc(f.dur)+' mins</span>':'')+
        '<span class="log-tag">'+esc(f.type)+'</span>'+
        '<span class="log-tag '+cc+'">'+esc(f.cond)+'</span>'+
        (f.wxWind?'<span class="log-tag">💨 '+esc(f.wxWind)+'</span>':'')+
        (f.wxTemp?'<span class="log-tag">🌡️ '+esc(f.wxTemp)+'</span>':'')+
        '</div>'+
        (f.notes?'<div class="log-entry-notes">📝 '+esc(f.notes)+'</div>':'')+
        '</div>';
    }
  }
  document.getElementById('log-body').innerHTML=stats+form+entries+'<div style="height:14px;"></div>'+proAccountCard();
}
function addFlight(){
  var loc=document.getElementById('li-loc').value.trim();
  if(!loc){showToast('Please enter a location');return;}
  var flights=loadFlights();
  var now=new Date();
  flights.push({
    date:document.getElementById('li-date').value||now.toISOString().split('T')[0],
    ts:now.toISOString(),
    loc:loc,
    drone:document.getElementById('li-drone').value.trim(),
    dur:document.getElementById('li-dur').value,
    type:document.getElementById('li-type').value,
    cond:document.getElementById('li-cond').value,
    notes:document.getElementById('li-notes').value.trim(),
    wxWind:(document.getElementById('li-wxwind')||{}).value||'',
    wxTemp:(document.getElementById('li-wxtemp')||{}).value||'',
    wxVis:(document.getElementById('li-wxvis')||{}).value||''
  });
  saveFlights(flights);
  showToast('✈️ Flight logged');
  renderLog();
}

// Rolling auto-backup — writes to the same file handle every time.
// On first use (or if handle lost), prompts user to pick a save location once.
// Subsequent saves go directly to that file with no prompts.
var _backupHandle=null; // FileSystemFileHandle, persisted across saves this session

function autoBackupLog(flights){
  if(!isPro())return; // backup is a Pro feature
  var data={version:1,exported:new Date().toISOString(),flights:flights};
  var json=JSON.stringify(data,null,2);

  // Try File System Access API (Chrome 86+, Edge, Android Chrome)
  if(window.showSaveFilePicker&&!_backupHandle){
    // First time — ask user to pick a file location once
    showToast('Choose where to save your rolling backup — you\'ll only be asked once');
    setTimeout(function(){
      window.showSaveFilePicker({
        suggestedName:'dronechecker-flight-log-backup.json',
        types:[{description:'DroneChecker Backup',accept:{'application/json':['.json']}}]
      }).then(function(handle){
        _backupHandle=handle;
        writeBackupToHandle(handle,json);
      }).catch(function(){
        // User cancelled — fall back to localStorage mirror
        saveBackupToStorage(json);
      });
    },800); // delay so flight-logged toast reads first
    return;
  }

  if(_backupHandle){
    // Subsequent saves — silent, no prompt
    writeBackupToHandle(_backupHandle,json);
    return;
  }

  // Fallback: keep a mirror in localStorage (retrievable via Restore)
  saveBackupToStorage(json);
}

function writeBackupToHandle(handle,json){
  handle.createWritable().then(function(writable){
    writable.write(json);
    return writable.close();
  }).then(function(){
    // Silent success — no toast needed
  }).catch(function(){
    _backupHandle=null; // handle lost (e.g. file deleted) — will re-prompt next time
    saveBackupToStorage(json);
  });
}

function saveBackupToStorage(json){
  // Mirror in localStorage as a fallback — retrievable via Restore button
  try{localStorage.setItem('dc_flights_backup',json);}catch(e){}
}
function deleteFlight(idx){
  if(!confirm('Delete this flight log entry?'))return;
  var flights=loadFlights();flights.splice(idx,1);saveFlights(flights);renderLog();
}
function clearFlights(){
  if(!confirm('Delete all flight logs? This cannot be undone.'))return;
  saveFlights([]);renderLog();
}
// ── Flight Log Export Functions ──────────────────────────────

// Build the CSV rows (shared by xlsx and sheets)
function buildCsvRows(flights){
  var bom='\uFEFF';
  var hdr='Date,Location,Drone,Duration (mins),Flight Type,Conditions,Wind,Temperature,Visibility,Notes\n';
  var rows='';
  flights.forEach(function(f){
    rows+=[csvCell(f.date),csvCell(f.loc),csvCell(f.drone),csvCell(f.dur),
           csvCell(f.type),csvCell(f.cond),csvCell(f.wxWind),csvCell(f.wxTemp),
           csvCell(f.wxVis),csvCell(f.notes)].join(',')+'\n';
  });
  return bom+hdr+rows;
}

// Excel export — uses SpreadsheetML XML format which Excel, Numbers
// and Google Sheets all open natively with proper formatting.
function exportXlsx(){
  if(!isPro()){openProOverlay();return;}
  var flights=loadFlights();
  if(!flights.length){showToast('No flights to export');return;}
  var condColour={'Good to Fly':'FF22C55E','Fly with Caution':'FFF59E0B','Do Not Fly':'FFEF4444'};
  var hdrs=['Date','Location','Drone','Duration (mins)','Flight Type','Conditions','Wind','Temperature','Visibility','Notes'];
  function xt(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function cell(v,bold,bg){
    var s=bold?'s=\"1\"':'';
    if(bg)s='s=\"2\" ';
    return '<Cell '+s+'><Data ss:Type=\"String\">'+ xt(v)+'</Data></Cell>';
  }
  var headerRow='<Row ss:StyleID=\"1\">'+ hdrs.map(function(h){return cell(h,true);}).join('')+'</Row>\n';
  var dataRows='';
  flights.forEach(function(f){
    var bg=condColour[f.cond]||'';
    dataRows+='<Row>'+
      cell(f.date)+cell(f.loc)+cell(f.drone)+cell(f.dur||'')+
      cell(f.type)+'<Cell ss:StyleID=\"'+( bg?'cond_'+f.cond.replace(/ /g,'_'):'' )+'\"><Data ss:Type=\"String\">'+ xt(f.cond)+'</Data></Cell>'+
      cell(f.wxWind)+cell(f.wxTemp)+cell(f.wxVis)+cell(f.notes)+
    '</Row>\n';
  });
  var xml='<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n'+
    '<?mso-application progid=\"Excel.Sheet\"?>\n'+
    '<Workbook xmlns=\"urn:schemas-microsoft-com:office:spreadsheet\"\n'+
    ' xmlns:ss=\"urn:schemas-microsoft-com:office:spreadsheet\">\n'+
    '<Styles>\n'+
    '<Style ss:ID=\"1\"><Font ss:Bold=\"1\" ss:Color=\"#FFFFFF\" ss:Size=\"11\"/><Interior ss:Color=\"#0F172A\" ss:Pattern=\"Solid\"/></Style>\n'+
    '<Style ss:ID=\"green\"><Interior ss:Color=\"#DCFCE7\" ss:Pattern=\"Solid\"/></Style>\n'+
    '<Style ss:ID=\"amber\"><Interior ss:Color=\"#FEF9C3\" ss:Pattern=\"Solid\"/></Style>\n'+
    '<Style ss:ID=\"red\"><Interior ss:Color=\"#FEE2E2\" ss:Pattern=\"Solid\"/></Style>\n'+
    '</Styles>\n'+
    '<Worksheet ss:Name=\"Flight Log\">\n<Table>\n'+
    headerRow+dataRows+
    '</Table></Worksheet></Workbook>';
  // Fix style IDs to use simple names
  xml=xml.replace(/ss:StyleID=\"cond_Good_to_Fly\"/g,'ss:StyleID=\"green\"')
         .replace(/ss:StyleID=\"cond_Fly_with_Caution\"/g,'ss:StyleID=\"amber\"')
         .replace(/ss:StyleID=\"cond_Do_Not_Fly\"/g,'ss:StyleID=\"red\"')
         .replace(/ss:StyleID=\"\"/g,'');
  var blob=new Blob([xml],{type:'application/vnd.ms-excel;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download='dronechecker-flights.xls';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  showToast('📊 Exported to Excel');
}

// Google Sheets — encode CSV and open in Google Sheets import URL
function exportGoogleSheets(){
  if(!isPro()){openProOverlay();return;}
  var flights=loadFlights();
  if(!flights.length){showToast('No flights to export');return;}
  var csv=buildCsvRows(flights);
  // Encode as data URI — Sheets can import a pasted CSV via the import dialog
  // Best we can do without a server: download CSV and open Sheets side-by-side
  var blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download='dronechecker-flights.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  // Open Google Sheets import page after short delay
  setTimeout(function(){
    window.open('https://sheets.new','_blank');
    showToast('CSV saved — import it in Sheets via File → Import');
  },600);
}

// JSON backup — full fidelity, can be restored on any device
function backupLog(){
  if(!isPro()){openProOverlay();return;}
  var flights=loadFlights();
  if(!flights.length){showToast('No flights to backup');return;}
  var data={version:1,exported:new Date().toISOString(),flights:flights};
  var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;
  a.download='dronechecker-backup-'+new Date().toISOString().split('T')[0]+'.json';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  showToast('💾 Backup saved ('+flights.length+' flights)');
}

// JSON restore — merges with existing log (no duplicates by date+loc+dur)
function restoreLog(input){
  if(!isPro()){openProOverlay();return;}
  var file=input.files[0];
  if(!file){
    // Try localStorage mirror as fallback
    try{
      var mirror=localStorage.getItem('dc_flights_backup');
      if(mirror){mergeRestoredFlights(JSON.parse(mirror));}
      else{showToast('No backup file or mirror found');}
    }catch(e){showToast('Could not read backup');}
    return;
  }
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      mergeRestoredFlights(JSON.parse(e.target.result));
    }catch(err){showToast('Could not read backup file');}
  };
  reader.readAsText(file);
  input.value='';
}

function mergeRestoredFlights(data){
  var incoming=Array.isArray(data)?data:(data.flights||[]);
  if(!incoming.length){showToast('No flights found in backup');return;}
  var existing=loadFlights();
  var merged=existing.slice();
  var added=0;
  incoming.forEach(function(f){
    var dup=existing.some(function(e){return e.date===f.date&&e.loc===f.loc&&e.dur===f.dur;});
    if(!dup){merged.push(f);added++;}
  });
  saveFlights(merged);renderLog();
  showToast(added+' flight'+(added!==1?'s':'')+' restored');
}
var disclaimerAccepted=false;
function checkDisclaimer(){
  var overlay=document.getElementById('disclaimer-overlay');
  if(!overlay)return;
  try{
    if(localStorage.getItem('dc_disclaimer')==='accepted'){
      disclaimerAccepted=true;
      overlay.style.display='none';
      return;
    }
  }catch(e){}
  if(disclaimerAccepted){overlay.style.display='none';return;}
  overlay.style.display='flex';
  document.body.style.overflow='hidden';
  // Hide scroll hint if content fits, or when user scrolls to the checkbox
  var sheet=overlay.querySelector('.disclaimer-sheet');
  var hint=document.getElementById('disc-scroll-hint');
  if(sheet&&hint){
    if(sheet.scrollHeight<=sheet.clientHeight){hint.style.display='none';}
    else{
      sheet.addEventListener('scroll',function(){
        var remaining=sheet.scrollHeight-sheet.scrollTop-sheet.clientHeight;
        if(remaining<60){hint.style.display='none';}
      },{passive:true});
    }
  }
}
function updateDisclaimerBtn(){
  var cb=document.getElementById('disclaimer-cb');
  var btn=document.getElementById('disclaimer-btn');
  if(!cb||!btn)return;
  btn.disabled=!cb.checked;
  btn.classList.toggle('ready',cb.checked);
}
function acceptDisclaimer(){
  var overlay=document.getElementById('disclaimer-overlay');
  if(!overlay)return;
  disclaimerAccepted=true;
  document.body.style.overflow='';
  try{localStorage.setItem('dc_disclaimer','accepted');}catch(e){}
  // Analytics consent is separate — only fire if the optional checkbox was ticked
  var analyticsCb=document.getElementById('analytics-cb');
  var analyticsConsent=analyticsCb&&analyticsCb.checked;
  try{localStorage.setItem('dc_analytics_consent',analyticsConsent?'accepted':'declined');}catch(e){}
  overlay.style.display='none';
  if(analyticsConsent&&typeof initAnalytics==='function')initAnalytics();
  checkOnboarding();
  setTimeout(applyDeepLink,300);
}
function shareConditions(){
  if(!wxData||!wxData.current){showToast('No data to share yet');return;}
  var c=wxData.current;
  var cond=flyRating(c.wind_speed_10m||0,c.wind_gusts_10m||0,c.visibility||10000,c.weather_code||0,currentKp,c.temperature_2m||15,c.wind_speed_80m||0,c.wind_speed_120m||0);
  var loc=document.getElementById('loc-name').textContent;
  var info=wmoInfo(c.weather_code||0);
  var emoji=cond.lvl==='green'?'🟢':cond.lvl==='amber'?'🟡':'🔴';
  var wind=spd(c.wind_speed_10m||0),gust=spd(c.wind_gusts_10m||0),u=spdU();
  var temp=Math.round(c.temperature_2m||0),tempF=Math.round(temp*9/5+32);
  var text;
  if(isPro()){
    var vis=visDisp(c.visibility||10000);
    var kpStr=currentKp>=5?'⚠ KP '+currentKp.toFixed(1)+' — possible GPS drift':currentKp>=4?'⚠ KP '+currentKp.toFixed(1)+' — monitor closely':'KP '+currentKp.toFixed(1)+' — stable';
    var w80=spd(c.wind_speed_80m||0),w120=spd(c.wind_speed_120m||0);
    var next24=getNext24hRatings(),wins=getFlightWindows(next24),now=new Date();
    var nextWin=null;for(var i=0;i<wins.length;i++){if(wins[i].start>now&&!nextWin){nextWin=wins[i];}}
    var winLine=nextWin?'🕐 Next window: '+pad(nextWin.start.getHours())+':00 – '+pad(new Date(nextWin.end.getTime()+3600000).getHours())+':00':'🕐 No flyable windows in next '+(isPro()?'72h':'6h');
    text=
      'DroneChecker Pro — Flying Conditions\n'+
      emoji+' '+cond.label+' in '+loc+'\n\n'+
      '🌤️ '+info.desc+'\n'+
      '💨 Wind: '+wind+' '+u+' · Gusts: '+gust+' '+u+'\n'+
      '📡 80m: '+w80+' '+u+' · 120m: '+w120+' '+u+'\n'+
      '🌡️ '+temp+'°C / '+tempF+'°F\n'+
      '👁 Visibility: '+vis.val+' '+vis.unit+'\n'+
      '🧲 '+kpStr+'\n'+
      winLine+'\n\n'+
      '🔗 dronechecker.co.uk';
  } else {
    text=
      'DroneChecker — Flying Conditions\n'+
      emoji+' '+cond.label+' in '+loc+'\n\n'+
      '🌤️ '+info.desc+'\n'+
      '💨 Wind: '+wind+' '+u+' · Gusts: '+gust+' '+u+'\n'+
      '🌡️ '+temp+'°C / '+tempF+'°F\n\n'+
      '🔗 dronechecker.co.uk';
  }
  var nudge=!isPro()?'Pro adds altitude wind, KP & next window to your share':null;
  doTextShare(text,nudge);
}

function doTextShare(text,nudge){
  if(navigator.share){
    navigator.share({text:text})
      .then(function(){if(nudge)showToast(nudge);})
      .catch(function(){});
  } else {
    navigator.clipboard.writeText(text)
      .then(function(){
        showToast('📋 Copied to clipboard');
        if(nudge)setTimeout(function(){showToast(nudge);},1800);
      })
      .catch(function(){showToast('Could not share');});
  }
}

function shareFlightWindow(){
  if(!wxData||!wxData.hourly)return;
  var loc=document.getElementById('loc-name')?document.getElementById('loc-name').textContent:'';
  var next24=getNext24hRatings(),wins=getFlightWindows(next24),now=new Date();
  var currentWin=null,nextWin=null;
  for(var i=0;i<wins.length;i++){
    var w=wins[i],wEnd=new Date(w.end.getTime()+3600000);
    if(now>=w.start&&now<wEnd){currentWin=w;}
    else if(w.start>now&&!nextWin){nextWin=w;}
  }
  var primaryWin=currentWin||nextWin;
  var isOpen=!!currentWin;
  var text;
  if(isPro()){
    var goodHours=next24.filter(function(r){return r.rating==='green';}).length;
    var cautionHours=next24.filter(function(r){return r.rating==='amber';}).length;
    var winLine,subLine='';
    if(!primaryWin){
      winLine='✈ No flyable windows in the next '+(isPro()?'72h':'6h');
    } else {
      var wEnd2=new Date(primaryWin.end.getTime()+3600000);
      var startStr=pad(primaryWin.start.getHours())+':00',endStr=pad(wEnd2.getHours())+':00';
      if(isOpen){
        var minsLeft=Math.round((wEnd2-now)/60000);
        winLine='✅ Window open now — until '+endStr;
        subLine=(minsLeft>=60?Math.floor(minsLeft/60)+'h '+(minsLeft%60)+'m':minsLeft+'m')+' remaining';
      } else {
        var isTomorrow=primaryWin.start.getDate()!==now.getDate();
        winLine='🕐 Next window: '+startStr+' – '+endStr;
        subLine=isTomorrow?'Tomorrow':countdown(primaryWin.start).replace('in ','Opens in ');
      }
    }
    if(nextWin&&isOpen){
      var nEnd=new Date(nextWin.end.getTime()+3600000);
      subLine+=(subLine?'\n':'')+'🕐 Then: '+pad(nextWin.start.getHours())+':00 – '+pad(nEnd.getHours())+':00';
    }
    text=
      'DroneChecker Pro — Best Flight Window\n'+
      '📍 '+loc+'\n\n'+
      winLine+'\n'+
      (subLine?subLine+'\n':'')+'\n'+
      '📊 Next 72h: '+goodHours+'h good · '+cautionHours+'h caution\n\n'+
      '🔗 dronechecker.co.uk';
  } else {
    var winTxt=primaryWin?
      pad(primaryWin.start.getHours())+':00 – '+pad(new Date(primaryWin.end.getTime()+3600000).getHours())+':00':
      'No flyable windows';
    text=
      'DroneChecker — Best Flight Window\n'+
      '✈ '+winTxt+' in '+loc+'\n\n'+
      '🔗 dronechecker.co.uk';
  }
  doTextShare(text);
}

function startIntervals(){
  setInterval(function(){
    if(document.hidden)return; // don't do work while the tab/app is backgrounded
    var updEl=document.getElementById('updated-txt');
    if(updEl&&lastUpdated)updEl.textContent='Updated '+timeSince(lastUpdated);
    if(document.getElementById('tab-gh')&&document.getElementById('tab-gh').classList.contains('on'))renderGolden();
  },60000);
  setInterval(function(){
    if(document.hidden)return;
    if(uLat&&uLng){fetchAll();}
  },1800000);
  // Returning to a backgrounded app: refresh the timestamp, and re-fetch if data is stale (>10 min)
  document.addEventListener('visibilitychange',function(){
    if(document.hidden)return;
    var updEl=document.getElementById('updated-txt');
    if(updEl&&lastUpdated)updEl.textContent='Updated '+timeSince(lastUpdated);
    if(uLat&&uLng&&lastUpdated&&(Date.now()-lastUpdated.getTime())>600000)fetchAll();
  });
}
var onboardSlide=0;var onboardTotal=5;
function checkOnboarding(){
  try{if(localStorage.getItem('dc_onboarded')==='1')return;}catch(e){}
  var overlay=document.getElementById('onboard-overlay');
  if(overlay)overlay.style.display='flex';
}
function nextSlide(){
  if(onboardSlide<onboardTotal-1){
    document.getElementById('onboard-'+onboardSlide).classList.remove('on');
    onboardSlide++;
    document.getElementById('onboard-'+onboardSlide).classList.add('on');
    var dots=document.querySelectorAll('.onboard-dot');
    dots.forEach(function(d,i){d.classList.toggle('on',i===onboardSlide);});
    if(onboardSlide===onboardTotal-1)document.getElementById('onboard-btn').textContent='Get Started 🚀';
  } else {
    finishOnboarding();
  }
}
function finishOnboarding(){
  try{localStorage.setItem('dc_onboarded','1');}catch(e){}
  var overlay=document.getElementById('onboard-overlay');
  if(overlay)overlay.style.display='none';
}
function replayOnboarding(){
  closeSettings();
  var cur=document.getElementById('onboard-'+onboardSlide);
  if(cur)cur.classList.remove('on');
  onboardSlide=0;
  var first=document.getElementById('onboard-0');
  if(first)first.classList.add('on');
  document.querySelectorAll('.onboard-dot').forEach(function(d,i){d.classList.toggle('on',i===0);});
  var btn=document.getElementById('onboard-btn');
  if(btn)btn.textContent='Next';
  var overlay=document.getElementById('onboard-overlay');
  if(overlay)overlay.style.display='flex';
}
function getLoc(forceFresh){
  if(!navigator.geolocation)return;
  // forceFresh=true uses maximumAge:0 — forces a real hardware fix,
  // prevents stale cached position from a previous location (e.g. different country).
  var opts=forceFresh?{timeout:15000,maximumAge:0}:{timeout:15000,maximumAge:60000};
  navigator.geolocation.getCurrentPosition(
    function(p){
      var newLat=p.coords.latitude,newLng=p.coords.longitude;
      var moved=!uLat||!uLng||Math.abs(newLat-uLat)>0.01||Math.abs(newLng-uLng)>0.01;
      uLat=newLat;uLng=newLng;
      // Don't set "Your Location" here — let revGeo resolve the real name
      revGeo();
      if(moved||forceFresh)fetchAll();
    },
    function(){}, // Silent failure — fetchAll() already fired from the load handler
    opts
  );
}
function setLoc(lat,lng,name){uLat=lat;uLng=lng;document.getElementById('loc-name').textContent=name;renderFavBar();fetchAll();}
function revGeo(){
  // Keep "Locating..." visible — don't pre-set "Your Location" as a placeholder.
  // Only save to lastLoc once a real place name is resolved.
  var locEl=document.getElementById('loc-name');
  if(locEl&&(locEl.textContent==='Locating...'||locEl.textContent==='London'))locEl.textContent='Locating...';
  // 12-second timeout, then fall back to Open-Meteo reverse geocoding
  var done=false;
  var timer=setTimeout(function(){
    if(done)return;
    fetch('https://geocoding-api.open-meteo.com/v1/search?name=&latitude='+uLat+'&longitude='+uLng+'&count=1&language=en&format=json')
      .then(function(r){return r.json();})
      .then(function(d){
        if(done)return;done=true;
        var name=(d.results&&d.results[0]&&d.results[0].name)||null;
        if(name){document.getElementById('loc-name').textContent=name;renderFavBar();saveLastLoc(uLat,uLng,name);}
        else{document.getElementById('loc-name').textContent='Your Location';}
      })
      .catch(function(){if(done)return;done=true;document.getElementById('loc-name').textContent='Your Location';});
  },12000);
  fetch('https://nominatim.openstreetmap.org/reverse?lat='+uLat+'&lon='+uLng+'&format=json')
    .then(function(r){return r.json();})
    .then(function(d){
      if(done)return;done=true;clearTimeout(timer);
      var a=d.address;
      var name=(a&&(a.city||a.town||a.village||a.suburb||a.hamlet||a.locality||a.county||a.state))||null;
      if(name){document.getElementById('loc-name').textContent=name;renderFavBar();saveLastLoc(uLat,uLng,name);}
      else{document.getElementById('loc-name').textContent='Your Location';}
    })
    .catch(function(){
      if(done)return;done=true;clearTimeout(timer);
      // Nominatim failed — let the timeout fallback handle it
    });
}
function isPostcode(q){return /^[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}$/i.test(q)||/^[A-Z]{1,2}\d{1,2}[A-Z]?$/i.test(q);}
function doSearch(){
  var q=document.getElementById('loc-inp').value.trim();if(!q)return;
  var err=document.getElementById('serr');err.style.display='none';
  document.getElementById('dash').innerHTML='<div class="skel skel-cond"></div><div class="skel skel-card"></div>';
  if(isPostcode(q)){
    fetch('https://api.postcodes.io/postcodes/'+encodeURIComponent(q.replace(/\s+/g,'')))
      .then(function(r){return r.json();})
      .then(function(d){if(d.status!==200||!d.result)throw new Error();uLat=d.result.latitude;uLng=d.result.longitude;document.getElementById('loc-name').textContent=d.result.admin_district||q.toUpperCase();renderFavBar();fetchAll();})
      .catch(function(){err.textContent='Postcode not found.';err.style.display='block';document.getElementById('dash').innerHTML='';});
  }else{
    fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(q)+'&count=1&language=en&format=json')
      .then(function(r){return r.json();})
      .then(function(d){if(!d.results||!d.results.length)throw new Error();var r=d.results[0];uLat=r.latitude;uLng=r.longitude;document.getElementById('loc-name').textContent=r.name+(r.admin1?', '+r.admin1:'');renderFavBar();fetchAll();})
      .catch(function(){err.textContent='Location not found.';err.style.display='block';document.getElementById('dash').innerHTML='';});
  }
}
function fetchWithTimeout(url,ms){
  return new Promise(function(resolve,reject){
    var timer=setTimeout(function(){reject(new Error('timeout'));},ms);
    fetch(url).then(function(r){clearTimeout(timer);resolve(r);}).catch(function(e){clearTimeout(timer);reject(e);});
  });
}
function fetchKp(attempt){
  attempt = attempt || 0;
  var liveUrl='https://services.swpc.noaa.gov/json/planetary_k_index_1m.json';
  var fcUrl='https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';
  Promise.all([
    fetchWithTimeout(liveUrl,3000).then(function(r){return r.json();}),
    fetchWithTimeout(fcUrl,3000).then(function(r){return r.json();})
  ]).then(function(results){
      var d=results[0],fc=results[1];
      var latest=d[d.length-1];
      currentKp=parseFloat(latest.kp_index||latest.Kp||0);
      var now=new Date();
      kpForecast=fc.filter(function(e){return new Date(e.time_tag)>=now;}).map(function(e){return{t:new Date(e.time_tag),kp:parseFloat(e.kp)||0};});
      try{localStorage.setItem('dc_kp',JSON.stringify({ts:Date.now(),kp:currentKp,fc:fc.slice(-40).map(function(e){return{t:e.time_tag,kp:e.kp};})}));}catch(e){}
      if(wxData){renderKpCard();updateCondBanner();renderFlightWindowIfVisible();}
    })
    .catch(function(){
      var delays=[30000,120000,300000];
      if(attempt < delays.length){
        setTimeout(function(){fetchKp(attempt+1);}, delays[attempt]);
        var card=document.getElementById('kp-card');
        if(card)card.innerHTML='<h2 class="card-ttl">Geomagnetic Activity — KP Index</h2><div style="font-size:12px;color:var(--muted);margin-top:4px;">KP data unavailable — retrying in '+Math.round(delays[attempt]/60000||0.5)+' min</div>';
      } else {
        var card2=document.getElementById('kp-card');
        if(card2)card2.innerHTML='<h2 class="card-ttl">Geomagnetic Activity — KP Index</h2><div style="font-size:12px;color:var(--muted);margin-top:4px;">KP data unavailable. Tap Refresh to try again.</div>';
      }
    });
}
function updateCondBanner(){
  if(!wxData||!wxData.current)return;
  var c=wxData.current;
  var wind=c.wind_speed_10m||0,gust=c.wind_gusts_10m||0,vis=c.visibility||10000,wmo=c.weather_code||0;
  var cond=flyRating(wind,gust,vis,wmo,currentKp,wxData.current.temperature_2m||15,wxData.current.wind_speed_80m||0,wxData.current.wind_speed_120m||0);
  var condEl=document.querySelector('.cond');
  if(!condEl)return;
  condEl.className='cond '+cond.lvl;
  var ring=condEl.querySelector('.cond-ring');
  if(ring)ring.className='cond-ring '+cond.lvl;
  var lbl=condEl.querySelector('.cond-lbl');
  if(lbl){lbl.className='cond-lbl '+cond.lvl;lbl.textContent=cond.label;}
  var curPrecipB=0;
  if(wxData.hourly&&wxData.hourly.precipitation_probability){var _nowSlot=Math.floor(Date.now()/3600000);for(var _pi=0;_pi<wxData.hourly.time.length;_pi++){if(Math.floor(locEntryMs(wxData.hourly.time[_pi])/3600000)===_nowSlot){curPrecipB=Math.round(wxData.hourly.precipitation_probability[_pi]||0);break;}}}
  var desc=condEl.querySelector('.cond-desc');
  if(desc)desc.textContent=qualifyPrecipDesc(cond.desc,curPrecipB);
}
function renderKpCard(){
  var kp=currentKp;
  var lvl,label,emoji,desc;
  if(kp<2){lvl='green';label='Quiet';emoji='🟢';desc='Calm geomagnetic conditions. No impact on your drone\'s GPS or compass systems.';}
  else if(kp<4){lvl='green';label='Unsettled';emoji='🟢';desc='Minor geomagnetic activity. Negligible impact on drone systems. Normal flight operations are unaffected.';}
  else if(kp<5){lvl='amber';label='Active';emoji='🟡';desc='Elevated geomagnetic activity. Your drone may experience subtle compass drift. Keep within close visual range and avoid automated GPS-dependent flight modes.';}
  else if(kp<6){lvl='amber';label='Minor Storm (G1)';emoji='🟡';desc='G1 geomagnetic storm. GPS accuracy can be reduced by several metres. Avoid flying close to obstacles or using Return-to-Home and automated modes that rely on GPS positioning.';}
  else if(kp<7){lvl='red';label='Moderate Storm (G2)';emoji='🔴';desc='G2 geomagnetic storm. GPS and compass systems may be significantly unreliable, causing position errors and unpredictable behaviour. Strongly advise against flying.';}
  else{lvl='red';label='Severe Storm (G3+)';emoji='🔴';desc='Severe geomagnetic storm. GPS is likely unreliable or unavailable. High risk of flyaway or loss of control. Do not fly.';}
  var col=lvl==='green'?'var(--green)':lvl==='amber'?'var(--amber)':'var(--red)';
  var bar=Math.min(Math.round((kp/9)*100),100);
  var fwCard=document.getElementById('flight-window-card');
  if(fwCard&&wxData)fwCard.outerHTML=renderFlightWindowCard();
  var card=document.getElementById('kp-card');if(!card)return;
  card.innerHTML='<h2 class="card-ttl">Geomagnetic Activity — KP Index</h2><div class="kp-row"><div class="kp-num" style="color:'+col+';">'+kp.toFixed(1)+'</div><div><div class="kp-lbl" style="color:'+col+';">'+emoji+' '+label+'</div><div class="kp-desc">'+desc+'</div></div></div><div class="kp-bar-bg"><div class="kp-bar" style="width:'+bar+'%;background:'+col+';"></div></div><div class="kp-scale"><span>0 — Quiet</span><span>4 — Storm</span><span>9 — Extreme</span></div>';
}
// ── Fetch weather from Open-Meteo (primary source) ───────────────────────
function fetchOpenMeteo(lat,lng){
  var url='https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lng+
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,surface_pressure,visibility,cloud_cover,wind_speed_80m,wind_speed_120m'+
    '&hourly=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,visibility,precipitation_probability,wind_speed_80m,wind_speed_120m,cloud_cover_low,cloud_cover_mid,cloud_cover_high'+
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max'+
    '&wind_speed_unit=kmh&timezone=auto&forecast_days=8';
  return fetchWithTimeout(url,12000)
    .then(function(r){if(!r.ok)throw new Error('Open-Meteo HTTP '+r.status);return r.json();});
}

var _fetchAllInFlight=false,_fetchAllPending=false;
function fetchAll(){
  var cached=loadWxCache();
  if(cached){wxData=cached.data;hideSplash();renderDash();renderFc();renderGolden();showOfflineBanner(cached.ts);}
  // Coalesce overlapping calls — never run two network fetches at once; re-run once on completion if asked again meanwhile
  if(_fetchAllInFlight){_fetchAllPending=true;return;}
  _fetchAllInFlight=true;
  fetchOpenMeteo(uLat,uLng)
    .then(function(data){
      wxData=data;
      wxLocUtcOffsetMs=(data.utc_offset_seconds||0)*1000;
      // Stamp lastUpdated only once live data confirmed for these coordinates
      lastUpdated=new Date();
      var updEl=document.getElementById('updated-txt');
      if(updEl)updEl.textContent='Updated just now';
      saveWxCache(data);hideOfflineBanner();hideSplash();
      renderDash();renderFc();renderGolden();
      // Update restrictions map centre if already initialised
      if(restrictInitDone&&restrictMap&&uLat&&uLng)flyToUserLocation(uLat,uLng);
      fetchKp();
    })
    .catch(function(err){
      console.warn('Open-Meteo fetch failed:',err);
      hideSplash();
      if(!wxData){
        var isFileOrigin=window.location.protocol==='file:';
        var msg=isFileOrigin
          ? 'Open the app via a local server or deployed URL — browsers block API calls from file:// for security.<br><br><small style="color:var(--muted);">Run: <code>npx serve .</code> then open localhost</small>'
          : 'Could not load weather data. Check your connection and try again.';
        document.getElementById('dash').innerHTML=
          '<div class="err">'+msg+'<br><br>'+
          '<button onclick="fetchAll()" style="background:var(--accent);border:none;border-radius:var(--radius-sm);padding:10px 20px;color:#020617;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">↻ Try Again</button></div>';
      }
    })
    .then(function(){
      _fetchAllInFlight=false;
      if(_fetchAllPending){_fetchAllPending=false;fetchAll();}
    });
}
function hideSplash(){var s=document.getElementById('splash');if(s){s.classList.add('hidden');setTimeout(function(){s.style.display='none';},300);}}
function toggleTileInfo(btn){
  var tile=btn.parentElement;while(tile&&!tile.classList.contains('wx-tile'))tile=tile.parentElement;
  if(!tile)return;
  var panel=tile.querySelector('.wx-info-panel');if(!panel)return;
  var open=panel.style.display==='block';
  panel.style.display=open?'none':'block';
  btn.classList.toggle('active',!open);
}
function tilePrecip(v){return v>=70?'red':v>=50?'amber':'green';}
function tileWind(v){var d=getDrone();return v>=d.windRed?'red':v>=d.windAmber?'amber':'green';}
function tileGust(v){var d=getDrone();return v>=d.gustRed?'red':v>=d.gustAmber?'amber':'green';}
function tileVis(v){return v<1000?'red':v<5000?'amber':'green';}
function tileCloud(v){return v>=70?'amber':'green';}
function tileHum(v){return v>90?'red':v>75?'amber':'green';}
function tilePres(v){return v<980?'red':v<1000?'amber':'green';}
function tileTemp(v){return v<-10||v>40?'red':v<0||v>35?'amber':'green';}
function tileCloudBase(m){return m<120?'red':m<150?'amber':'green';}
function tileDensityAlt(m){return m>2000?'red':m>1000?'amber':'green';}
function ndFilterRec(cloud,sunElDeg){
  // Effective brightness: sun elevation damped by cloud cover (clouds diffuse direct light)
  if(sunElDeg<=0)return{col:'green',lvl:'Not needed',sub:'Low light — no ND filter required'};
  var eff=sunElDeg*(1-(cloud/100)*0.85);
  if(eff<8)return{col:'green',lvl:'Not needed',sub:'Soft, diffused light'};
  if(eff<22)return{col:'amber',lvl:'ND4–ND8',sub:'Bright daylight — filter smooths footage'};
  return{col:'red',lvl:'ND16–ND32',sub:'Strong sun — filter needed for cinematic shutter speed'};
}
function cameraRec(cloud,sunElDeg){
  var cam=getDroneCamera();
  var eff=sunElDeg<=0?0:sunElDeg*(1-(cloud/100)*0.85);
  var ceiling=cam.isoCeiling||SENSOR_ISO_CEILING[cam.sensor]||1600;
  var iso,isoNote;
  if(eff<=0){
    iso=Math.min(ceiling,cam.isoVideoMax);
    isoNote=ceiling>=3200?'Night — '+cam.sensor+' sensor handles ISO '+iso+' cleanly':'Night — push ISO to '+iso+', smaller sensor will show noise past this';
  }
  else if(eff<8){iso=Math.min(Math.max(cam.isoBase*4,400),ceiling);isoNote='Low light — slight ISO boost keeps shutter usable';}
  else{iso=cam.isoBase;isoNote='Bright — keep ISO at base for the cleanest image';}
  var apertureText,apertureNote;
  if(cam.apertureFixed){
    apertureText='f/'+cam.apertureMin+' (fixed)';
    apertureNote='No control on this drone — use ND + shutter/ISO to manage exposure';
  }else if(eff<8){
    apertureText='f/'+cam.apertureMin+' (wide open)';
    apertureNote='Low light — widest aperture gathers the most light';
  }else if(eff<22){
    apertureText='f/4–f/5.6';
    apertureNote='Stop down a little for extra sharpness and depth';
  }else{
    apertureText='f/8–f/'+cam.apertureMax;
    apertureNote='Bright sun — stop down to control exposure, pair with ND for video';
  }
  var shutterVideo='1/50s (25fps, 180° rule)';
  var shutterPhoto;
  if(eff<=0){
    shutterPhoto=ceiling>=1600?'1/30–1/60s — brace for a steady hover':'1/8–1/15s — lower ISO ceiling needs a slower shutter, hover as still as possible';
  }else if(eff<8){
    shutterPhoto='1/100–1/200s';
  }else{
    shutterPhoto='1/500–1/1000s';
  }
  var wb;
  if(sunElDeg<=0)wb='Auto / ~4500K — artificial light dominant';
  else if(sunElDeg<6)wb='~5000–5500K — lock WB to hold the golden/blue tones';
  else if(cloud>=50)wb='~6500–7000K — counters the blue cast from overcast sky';
  else wb='~5600K daylight — Auto WB is fine';
  var nd=ndFilterRec(cloud,sunElDeg);
  if(!cam.apertureFixed&&nd.col!=='green'){
    nd={col:nd.col,lvl:nd.lvl,sub:nd.sub+' — variable aperture eases this, but ND still gives the smoothest 180° shutter.'};
  }
  return{cam:cam,iso:iso,isoNote:isoNote,aperture:apertureText,apertureNote:apertureNote,shutterVideo:shutterVideo,shutterPhoto:shutterPhoto,wb:wb,nd:nd};
}
function gpsQuality(kp,hourOfDay){
  // Ionospheric scintillation model for mid-latitude (UK ~53N)
  // Base score 10; KP degrades it; time-of-day adds minor modifier
  // Peak ionospheric disturbance: 13-16 UTC and 20-22 UTC
  var score=10;
  if(kp>=6)score-=6;
  else if(kp>=5)score-=4;
  else if(kp>=4)score-=3;
  else if(kp>=3)score-=2;
  else if(kp>=2)score-=1;
  // Time-of-day modifier (-1 during peak ionospheric hours)
  if(hourOfDay>=13&&hourOfDay<=16)score-=1;
  else if(hourOfDay>=20&&hourOfDay<=22)score-=1;
  score=Math.max(0,Math.min(10,score));
  var label,sub,col;
  if(score>=8){label='Good';sub='No ionospheric interference';col='green';}
  else if(score>=6){label='Fair';sub='Minor interference — accuracy may vary';col='amber';}
  else if(score>=4){label='Degraded';sub='Avoid autonomous flight modes';col='amber';}
  else{label='Unreliable';sub='Avoid GPS-dependent flight';col='red';}
  return{label:label,sub:sub,col:col,score:score};
}
function tileCol(r){return r==='green'?'var(--green)':r==='amber'?'var(--amber)':'var(--red)';}
// ---- Pro: configurable fly rating thresholds ----
var _allProThresholds={};
function _thrKey(){return'dc_pro_thr_'+(selectedDrone||'mini4pro');}
function loadProThresholds(){try{var s=localStorage.getItem('dc_all_pro_thresholds');_allProThresholds=s?JSON.parse(s):{};}catch(e){_allProThresholds={};}}
function saveProThresholds(t){
  var key=selectedDrone||'mini4pro';
  _allProThresholds[key]=t;
  try{localStorage.setItem('dc_all_pro_thresholds',JSON.stringify(_allProThresholds));}catch(e){}
  if(isPro()&&proUser&&proUser.uid&&_fbLoaded){
    try{
      var db=firebase.firestore();
      db.collection('users').doc(proUser.uid).set(
        {windThresholds:_allProThresholds,thresholdsUpdated:firebase.firestore.FieldValue.serverTimestamp()},
        {merge:true}
      ).catch(function(e){console.error('[DC] Firestore saveProThresholds error:',e);});
    }catch(e){console.error('[DC] saveProThresholds cloud error:',e);}
  }
}
function getThresholds(){
  var key=selectedDrone||'mini4pro';
  if(isPro()&&_allProThresholds[key])return _allProThresholds[key];
  var d=getDrone();
  return{windAmber:d.windAmber,windRed:d.windRed,gustAmber:d.gustAmber,gustRed:d.gustRed};
}
function hasCustomThresholds(){
  var key=selectedDrone||'mini4pro';
  return isPro()&&!!_allProThresholds[key];
}
function resetProThresholds(){
  var key=selectedDrone||'mini4pro';
  delete _allProThresholds[key];
  try{localStorage.setItem('dc_all_pro_thresholds',JSON.stringify(_allProThresholds));}catch(e){}
  if(isPro()&&proUser&&proUser.uid&&_fbLoaded){
    try{
      var db=firebase.firestore();
      db.collection('users').doc(proUser.uid).set(
        {windThresholds:_allProThresholds,thresholdsUpdated:firebase.firestore.FieldValue.serverTimestamp()},
        {merge:true}
      ).catch(function(e){console.error('[DC] Firestore resetProThresholds error:',e);});
    }catch(e){console.error('[DC] resetProThresholds cloud error:',e);}
  }
  if(wxData){renderDash();renderFc();}renderFavBar();
  if(typeof showProSignedIn==='function')showProSignedIn();
  showToast('Thresholds reset to '+getDrone().name+' defaults');
}
function syncThresholdsFromCloud(uid,callback){
  if(!_fbLoaded||!uid){if(callback)callback();return;}
  try{
    var db=firebase.firestore();
    db.collection('users').doc(uid).get().then(function(snap){
      if(snap.exists&&snap.data().windThresholds){
        var cloud=snap.data().windThresholds;
        // Cloud wins per drone key; keep any local keys not in cloud
        Object.keys(cloud).forEach(function(k){_allProThresholds[k]=cloud[k];});
        try{localStorage.setItem('dc_all_pro_thresholds',JSON.stringify(_allProThresholds));}catch(e){}
        if(wxData){renderDash();renderFc();}
      }
      if(callback)callback();
    }).catch(function(e){
      console.error('[DC] syncThresholdsFromCloud error:',e);
      if(callback)callback();
    });
  }catch(e){
    console.error('[DC] syncThresholdsFromCloud error:',e);
    if(callback)callback();
  }
}
function toggleMoreConditions(){
  var body=document.getElementById('more-cond-body');
  var chevron=document.getElementById('more-cond-chevron');
  var label=document.getElementById('more-cond-label');
  if(!body)return;
  var open=body.style.display==='none';
  body.style.display=open?'block':'none';
  if(chevron)chevron.style.transform=open?'rotate(180deg)':'';
  try{localStorage.setItem('dc_more_cond',open?'1':'0');}catch(e){}
}
function initMoreConditions(){
  try{
    if(localStorage.getItem('dc_more_cond')==='1'){
      var body=document.getElementById('more-cond-body');
      var chevron=document.getElementById('more-cond-chevron');
      if(body)body.style.display='block';
      if(chevron)chevron.style.transform='rotate(180deg)';
    }
  }catch(e){}
}
function thrDisp(kmh){return spd(kmh)+' '+spdU();}
function buildThresholdUI(){
  var t=getThresholds();var d=getDrone();var isCustom=hasCustomThresholds();
  function row(id,label,val,max,cls){
    var pct=Math.round(val/max*100);
    return '<div class="threshold-row">'+
      '<div class="threshold-label">'+label+'</div>'+
      '<input class="threshold-slider '+cls+'" type="range" min="5" max="'+max+'" step="1" value="'+val+'" style="--pct:'+pct+'%" oninput="updateThresholdSlider(this,&apos;'+id+'&apos;)" onchange="applyThreshold(&apos;'+id+'&apos;,this.value)">'+
      '<div class="threshold-val" id="thr-val-'+id+'">'+thrDisp(val)+'</div>'+
    '</div>';
  }
  return '<div class="threshold-section">'+
    '<div class="threshold-title">Fly Rating Thresholds</div>'+
    '<div style="font-size:11px;color:var(--muted);margin-bottom:10px;">Customise when conditions turn amber or red. Currently using <strong>'+(isCustom?'your custom settings':esc(d.name)+' defaults')+'</strong>.</div>'+
    row('windAmber','Wind caution',t.windAmber,80,'amber')+
    row('windRed','Wind avoid',t.windRed,80,'red')+
    row('gustAmber','Gust caution',t.gustAmber,100,'amber')+
    row('gustRed','Gust avoid',t.gustRed,100,'red')+
    (isCustom?'<div class="threshold-reset" onclick="resetProThresholds()">Reset to '+esc(d.name)+' defaults</div>':'')+
  '</div>';
}
function updateThresholdSlider(input,id){
  var val=parseInt(input.value),max=parseInt(input.max);
  input.style.setProperty('--pct',Math.round(val/max*100)+'%');
  var el=document.getElementById('thr-val-'+id);if(el)el.textContent=thrDisp(val);
}
function applyThreshold(id,rawVal){
  var val=parseInt(rawVal);var current=getThresholds();current[id]=val;
  if(id==='windAmber'&&current.windAmber>=current.windRed)current.windRed=current.windAmber+5;
  if(id==='windRed'&&current.windRed<=current.windAmber)current.windAmber=current.windRed-5;
  if(id==='gustAmber'&&current.gustAmber>=current.gustRed)current.gustRed=current.gustAmber+5;
  if(id==='gustRed'&&current.gustRed<=current.gustAmber)current.gustAmber=current.gustRed-5;
  saveProThresholds(current);if(wxData){refreshDashCards();renderFc();}renderFavBar();
  // Update drone name/status in sheet if open
  var dn=document.querySelector('.thr-drone-name');
  if(dn){var d2=getDrone();dn.textContent=d2.name+(hasCustomThresholds()?' \u2022 Custom':' \u2022 Default');}
  // Show reset link if now custom
  var rs=document.querySelector('#thr-sheet-body .threshold-reset');
  if(!rs&&hasCustomThresholds()){var body2=document.getElementById('thr-sheet-body');if(body2){var div=document.createElement('div');div.className='threshold-reset';div.onclick=resetProThresholds;div.textContent='Reset to '+getDrone().name+' defaults';body2.appendChild(div);}}
}
function flyRating(wind,gust,vis,wmo,kp,temp,wind80,wind120){
  var d=getDrone(),thr=getThresholds(),lvl='green',issues=[];
  var t=temp!==undefined?temp:15;
  if(t<-10){issues.push('Extreme cold ('+tmp(t)+tmpU()+') — do not fly');lvl='red';}
  else if(t<0){issues.push('Below freezing ('+tmp(t)+tmpU()+') — battery and icing risk');if(lvl!=='red')lvl='amber';}
  else if(t>40){issues.push('Extreme heat ('+tmp(t)+tmpU()+') — overheating risk');if(lvl!=='red')lvl='amber';}
  else if(t>35){issues.push('High temperature ('+tmp(t)+tmpU()+') — monitor for overheating');if(lvl!=='red')lvl='amber';}
  if(gust>=thr.gustRed){issues.push('Gusts too strong ('+spd(gust)+' '+spdU()+')');lvl='red';}
  else if(gust>=thr.gustAmber){issues.push('Strong gusts ('+spd(gust)+' '+spdU()+')');if(lvl!=='red')lvl='amber';}
  if(wind>=thr.windRed){issues.push('Wind too strong ('+spd(wind)+' '+spdU()+')');lvl='red';}
  else if(wind>=thr.windAmber){issues.push('Moderate wind ('+spd(wind)+' '+spdU()+')');if(lvl!=='red')lvl='amber';}
  if(wind120!==undefined&&wind120>=thr.windRed){issues.push('Wind at 120m too strong ('+spd(wind120)+' '+spdU()+')');lvl='red';}
  else if(wind120!==undefined&&wind120>=thr.windAmber){issues.push('Strong wind at 120m ('+spd(wind120)+' '+spdU()+')');if(lvl!=='red')lvl='amber';}
  else if(wind80!==undefined&&wind80>=thr.windRed){issues.push('Wind at 80m too strong ('+spd(wind80)+' '+spdU()+')');lvl='red';}
  else if(wind80!==undefined&&wind80>=thr.windAmber){issues.push('Strong wind at 80m ('+spd(wind80)+' '+spdU()+')');if(lvl!=='red')lvl='amber';}
  if(vis<1000){issues.push('Very poor visibility');lvl='red';}
  else if(vis<5000){issues.push('Reduced visibility');if(lvl!=='red')lvl='amber';}
  if(wmo>=95){issues.push('Thunderstorm');lvl='red';}
  else if(wmo===65||wmo===67||wmo===75||wmo===82||wmo===86){issues.push('Heavy precipitation — do not fly');lvl='red';}
  else if(wmo===56||wmo===57||wmo===66){issues.push('Freezing precipitation — ice risk');lvl='red';}
  else if(wmo===63||wmo===73||wmo===81){issues.push(wmo===73?'Snow':'Rain — water ingress risk');lvl='red';}
  else if(wmo===55){issues.push('Heavy drizzle — water ingress risk');if(lvl!=='red')lvl='amber';}
  else if(wmo===51||wmo===53){issues.push('Drizzle — no water resistance on most drones');if(lvl!=='red')lvl='amber';}
  else if(wmo===61||wmo===80){issues.push('Light rain — water ingress risk');if(lvl!=='red')lvl='amber';}
  else if(wmo===71||wmo===77||wmo===85){issues.push('Light snow — motor and prop interference');if(lvl!=='red')lvl='amber';}
  else if(wmo===45||wmo===48){issues.push('Fog — poor visibility');if(lvl!=='red')lvl='amber';}
  var kpVal=kp||currentKp||0;
  if(kpVal>=6){issues.push('Severe geomagnetic storm (KP '+kpVal.toFixed(1)+') — GPS unreliable');lvl='red';}
  else if(kpVal>=4){issues.push('Geomagnetic activity (KP '+kpVal.toFixed(1)+') — possible GPS drift');if(lvl!=='red')lvl='amber';}
  var labels={green:'✓ Good to Fly',amber:'⚠ Fly with Caution',red:'✕ Do Not Fly'};
  return{lvl:lvl,label:labels[lvl],desc:lvl==='green'?'Conditions look good for your '+esc(getDrone().name)+'.':issues.join('. ')+(lvl==='amber'?' — fly carefully.':' — not safe for your '+esc(getDrone().name)+'.')};
}

function getKpForTime(t){
  if(!kpForecast.length)return currentKp;
  var best=currentKp;
  var tMs=t.getTime();
  for(var i=0;i<kpForecast.length;i++){
    var entry=kpForecast[i];
    var entryMs=entry.t.getTime();
    var nextMs=i+1<kpForecast.length?kpForecast[i+1].t.getTime():entryMs+3*3600000;
    if(tMs>=entryMs&&tMs<nextMs){best=entry.kp;break;}
  }
  return best;
}
function getHourlyRatings(numHours){
  if(!wxData||!wxData.hourly)return[];
  var hours=wxData.hourly,now=new Date();
  var windowStartMs=Math.floor(Date.now()/3600000)*3600000;
  var windowEndMs=windowStartMs+numHours*3600000;
  var results=[];
  for(var i=0;i<hours.time.length;i++){
    var t=new Date(hours.time[i]);
    var tMs=locEntryMs(hours.time[i]);
    if(tMs<windowStartMs||tMs>=windowEndMs)continue;
    var cur=wxData.current,isNow=cur&&Math.floor(tMs/3600000)===Math.floor(Date.now()/3600000);
    var w=isNow?(cur.wind_speed_10m||0):(hours.wind_speed_10m[i]||0);
    var g=isNow?(cur.wind_gusts_10m||0):(hours.wind_gusts_10m?hours.wind_gusts_10m[i]||0:0);
    var v=isNow?(cur.visibility||10000):(hours.visibility?hours.visibility[i]||10000:10000);
    var wmo=isNow?(cur.weather_code||0):(hours.weather_code?hours.weather_code[i]||0:0);
    var tp=isNow?(cur.temperature_2m||15):(hours.temperature_2m?hours.temperature_2m[i]||15:15);
    var w80=isNow?(cur.wind_speed_80m||0):(hours.wind_speed_80m?hours.wind_speed_80m[i]||0:0);
    var w120=isNow?(cur.wind_speed_120m||0):(hours.wind_speed_120m?hours.wind_speed_120m[i]||0:0);
    var precip=hours.precipitation_probability?Math.round(hours.precipitation_probability[i]||0):0;
    var kpT=getKpForTime(t);
    var r=flyRating(w,g,v,precipAdjustWmo(wmo,precip),kpT,tp,w80,w120);
    results.push({hour:t.getHours(),rating:r.lvl,time:t,kp:kpT});
  }
  return results;
}
function getNext24hRatings(){return getHourlyRatings(isPro()?72:6);}
function _oldGetNext24hRatings(){
  if(!wxData||!wxData.hourly)return[];
  var hours=wxData.hourly,now=new Date();
  var windowStart=new Date(now);windowStart.setMinutes(0,0,0);
  var windowEnd=new Date(windowStart.getTime()+24*3600000);
  var results=[];
  for(var i=0;i<hours.time.length;i++){
    var t=new Date(hours.time[i]);
    if(t<windowStart||t>=windowEnd)continue;
    var w=hours.wind_speed_10m[i]||0,g=hours.wind_gusts_10m?hours.wind_gusts_10m[i]||0:0;
    var v=hours.visibility?hours.visibility[i]||10000:10000,wmo=hours.weather_code?hours.weather_code[i]||0:0;
    var tmp=hours.temperature_2m?hours.temperature_2m[i]||15:15;
    var w80=hours.wind_speed_80m?hours.wind_speed_80m[i]||0:0,w120=hours.wind_speed_120m?hours.wind_speed_120m[i]||0:0;
    var kpT=getKpForTime(t);
    var r=flyRating(w,g,v,wmo,kpT,tmp,w80,w120);
    results.push({hour:t.getHours(),rating:r.lvl,time:t,kp:kpT});
  }
  return results;
}
function buildHourStrip(hourlyRatings,now){
  var totalHours=hourlyRatings.length;
  var is72=totalHours>24;
  var dayBoundaries=[];
  if(is72){for(var d=1;d<hourlyRatings.length;d++){if(hourlyRatings[d].hour===0)dayBoundaries.push(d);}}

  // Day labels ABOVE bar (72h only)
  var dayLabelHtml='';
  if(is72){
    dayLabelHtml='<div style="position:relative;height:14px;margin-bottom:2px;">';
    for(var b=0;b<dayBoundaries.length;b++){
      var bIdx=dayBoundaries[b];
      var bPct=Math.round((bIdx/totalHours)*100);
      var dayDate=new Date(hourlyRatings[bIdx].time);
      var dayLbl=dayDate.toLocaleDateString('en-GB',{weekday:'short'});
      dayLabelHtml+='<span class="day-bar-lbl" style="position:absolute;left:'+bPct+'%;transform:translateX(-50%);font-size:10px;font-weight:600;letter-spacing:.3px;">'+dayLbl+'</span>';
    }
    dayLabelHtml+='</div>';
  }

  // Bar
  var strip='<div style="display:flex;gap:1px;position:relative;">';
  for(var i=0;i<hourlyRatings.length;i++){
    var entry=hourlyRatings[i];
    var col=entry.rating==='green'?'#22c55e':entry.rating==='amber'?'#f59e0b':entry.rating==='red'?'#ef4444':'#334155';
    var isNowHour=entry.hour===now.getHours()&&i===0;
    var isDayStart=dayBoundaries.indexOf(i)>=0;
    var bLeft=isDayStart?'border-left:2px solid rgba(255,255,255,.25);':'';    strip+='<div title="'+pad(entry.hour)+':00" style="flex:1;height:20px;background:'+col+';border-radius:2px;'+bLeft+(isNowHour?'box-shadow:0 0 0 1.5px #fff;':'')+'"></div>';
  }
  strip+='</div>';

  // Hour labels BELOW bar
  var labelHtml='<div style="position:relative;height:16px;margin-top:3px;margin-bottom:4px;">';
  if(is72){
    var startH=hourlyRatings[0]?pad(hourlyRatings[0].hour):'00';
    var endH=hourlyRatings[totalHours-1]?pad((hourlyRatings[totalHours-1].hour+1)%24):'00';
    labelHtml+='<span style="position:absolute;left:0;font-size:10px;color:var(--muted);">'+startH+'</span>';
    labelHtml+='<span style="position:absolute;right:0;font-size:10px;color:var(--muted);">'+endH+'</span>';
  } else {
    var ticks=[];
    for(var t=0;t<hourlyRatings.length;t++){if(t%6===0)ticks.push({idx:t,label:pad(hourlyRatings[t].hour)});}
    for(var k=0;k<ticks.length;k++){
      var leftPct=Math.round((ticks[k].idx/Math.max(totalHours-1,1))*100);
      if(leftPct>85&&k<ticks.length-1)continue;
      var xform=k===0?'none':'translateX(-50%)';
      labelHtml+='<span style="position:absolute;left:'+leftPct+'%;transform:'+xform+';font-size:10px;color:var(--muted);">'+ticks[k].label+'</span>';
    }
    var lastE=hourlyRatings[totalHours-1];
    var endHr=lastE?pad((lastE.hour+1)%24):'00';
    labelHtml+='<span style="position:absolute;right:0;font-size:10px;color:var(--muted);">'+endHr+'</span>';
  }
  labelHtml+='</div>';
  return dayLabelHtml+strip+labelHtml;
}
function getFlightWindows(hourlyRatings){
  var windows=[],inWindow=false,winStart=null,winEnd=null;
  for(var i=0;i<hourlyRatings.length;i++){
    var entry=hourlyRatings[i];
    if(entry.rating==='green'){if(!inWindow){inWindow=true;winStart=entry.time;}winEnd=entry.time;}
    else{if(inWindow){windows.push({start:winStart,end:winEnd});inWindow=false;}}
  }
  if(inWindow)windows.push({start:winStart,end:winEnd});
  return windows;
}
function renderFlightWindowIfVisible(){
  var fwCard=document.getElementById('flight-window-card');
  if(fwCard&&wxData)fwCard.outerHTML=renderFlightWindowCard();
}
// Replace only the Current Weather card in place (split out of renderDash so it can
// be rebuilt independently of the rest of the dashboard).
function renderWeatherCardIfPresent(){
  var el=document.getElementById('weather-card');
  if(el&&wxData&&wxData.current){el.outerHTML=renderWeatherCard();initMoreConditions();}
}
// Replace only the "Today's conditions summary" (best-time) card in place.
function renderBestTimeIfPresent(){
  var el=document.getElementById('best-time-card');
  if(el)el.outerHTML=renderBestTimeCard();
}
// Refresh just the data-driven dashboard cards in place — used by unit toggle and
// threshold changes, which never alter the dashboard's structure (Pro state, warnings).
// Avoids rebuilding the entire #dash innerHTML and the layout/handler thrash that brings.
function refreshDashCards(){
  if(!document.getElementById('weather-card')||!wxData||!wxData.current){renderDash();return;}
  updateCondBanner();
  renderWeatherCardIfPresent();
  renderBestTimeIfPresent();
  renderFlightWindowIfVisible();
  if(typeof _lastDashSig!=='undefined')_lastDashSig=_dashSignature();
}
function loadKpCache(){
  try{
    var s=localStorage.getItem('dc_kp');if(!s)return;
    var cached=JSON.parse(s);
    if(Date.now()-cached.ts>3600000)return;
    currentKp=cached.kp||0;
    var now=new Date();
    if(cached.fc){kpForecast=cached.fc.filter(function(e){return new Date(e.t)>=now;}).map(function(e){return{t:new Date(e.t),kp:parseFloat(e.kp)||0};});}
  }catch(e){}
}
function renderFlightWindowCard(){
  if(!wxData||!wxData.hourly)return '<div class="card" id="flight-window-card"><h2 class="card-ttl">Best Flight Window</h2><div style="font-size:13px;color:var(--muted);">No data available.</div></div>';
  var now=new Date();
  var next24=getNext24hRatings();
  var windows=getFlightWindows(next24);
  var currentWin=null,nextWin=null;
  for(var i=0;i<windows.length;i++){
    var w=windows[i];var wEnd=new Date(w.end.getTime()+3600000);
    if(now>=w.start&&now<wEnd){currentWin=w;break;}
    if(w.start>now&&!nextWin){nextWin=w;}
  }
  var primaryWin=currentWin||nextWin;
  var isNowOpen=!!currentWin;
  var isTomorrow=primaryWin&&primaryWin.start.getDate()!==now.getDate();
  // Detect if window is amber-only (no green slots)
  var winIsAmberOnly=false;
  if(primaryWin){
    var greenInWin=next24.filter(function(r){return r.rating==='green'&&r.time>=primaryWin.start&&r.time<=primaryWin.end;});
    winIsAmberOnly=greenInWin.length===0;
  }
  // Detect transition point from green → amber within an open window
  var transitionHour=null;
  if(isNowOpen&&!winIsAmberOnly){
    var seenGreen=false;
    for(var ti=0;ti<next24.length;ti++){
      var slot=next24[ti];
      if(slot.time<primaryWin.start)continue;
      if(slot.time>new Date(primaryWin.end.getTime()+3600000))break;
      if(slot.rating==='green'){seenGreen=true;}
      else if(seenGreen&&(slot.rating==='amber'||slot.rating==='red')){
        transitionHour=slot.time;
        break;
      }
    }
  }
  var hourStrip=buildHourStrip(next24,now);
  var nowActualRating='green';
  if(wxData&&wxData.current){var _c=wxData.current;nowActualRating=flyRating(_c.wind_speed_10m||0,_c.wind_gusts_10m||0,_c.visibility||10000,_c.weather_code||0,currentKp,_c.temperature_2m||15,_c.wind_speed_80m||0,_c.wind_speed_120m||0).lvl;}
  var mainHtml='';
  if(!primaryWin){
    mainHtml='<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">'+
      '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="19" fill="rgba(100,116,139,.08)" stroke="#475569" stroke-width="1.5" stroke-dasharray="4 3"/><circle cx="20" cy="20" r="11" fill="none" stroke="#475569" stroke-width="1.5"/><line x1="14" y1="14" x2="26" y2="26" stroke="#64748b" stroke-width="2.5" stroke-linecap="round"/><line x1="26" y1="14" x2="14" y2="26" stroke="#64748b" stroke-width="2.5" stroke-linecap="round"/></svg>'+
      '<div><div style="font-size:15px;font-weight:700;color:var(--muted);">No flyable windows in the next '+(isPro()?'72 hours':'6 hours')+'</div>'+
      '<div style="font-size:12px;color:var(--muted);margin-top:1px;">Check conditions again tomorrow.</div></div></div>';
  } else {
    var wEnd=new Date(primaryWin.end.getTime()+3600000);
    var durationMs=wEnd-(isNowOpen?now:primaryWin.start);
    var durationH=Math.floor(durationMs/3600000),durationM=Math.floor((durationMs%3600000)/60000);
    var durationStr=durationH>0?durationH+'h'+(durationM>0?' '+durationM+'m':''):durationM+'m';
    var startStr=pad(primaryWin.start.getHours())+':00',endStr=pad(wEnd.getHours())+':00';
    var wEndSameDay=wEnd.toDateString()===now.toDateString();
    var wEndDay=wEnd.toLocaleDateString('en-GB',{weekday:'short'});
    var endLabel=wEndSameDay?endStr:wEndDay+' '+endStr;
    var col=winIsAmberOnly?'var(--amber)':(isNowOpen?'var(--green)':'var(--accent)');
    var label=isNowOpen?(winIsAmberOnly?'Open now · Caution':'Open now'):(winIsAmberOnly?'Flyable with caution'+(isTomorrow?' · Tomorrow':''):'Next window'+(isTomorrow?' · Tomorrow':''));
    var endLabelFull=wEndSameDay?endStr:wEndDay+' '+endStr;
    var timeStr=isNowOpen?'Until '+endLabelFull:startStr+' – '+endStr;
    var longWindow=durationH>=6;
    var subStr=isNowOpen
      ?(winIsAmberOnly
        ?(longWindow?'Caution conditions until '+endLabel:'Not ideal — fly carefully')
        :(nowActualRating!=='green'
          ?'Caution now'
          :(transitionHour
            ?(function(){
              var tSameDay=transitionHour.toDateString()===now.toDateString();
              var tDay=transitionHour.toLocaleDateString('en-GB',{weekday:'short'});
              var tLabel=(tSameDay?'':tDay+' ')+pad(transitionHour.getHours())+':00';
              return longWindow?'Caution from '+tLabel:durationStr+' remaining · Caution from '+tLabel;
            })()
            :(longWindow?'':durationStr+' remaining'))))
      :(isTomorrow?'Starts tomorrow':('Opens in '+countdown(primaryWin.start).replace('in ','')));
    mainHtml='<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">'+
      (isNowOpen?'<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="19" fill="rgba(34,197,94,.12)" stroke="#22c55e" stroke-width="1.5"/><circle cx="20" cy="20" r="13" fill="rgba(34,197,94,.2)" stroke="#22c55e" stroke-width="1.5"/><polyline points="12,20 17,26 28,13" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>':'<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="19" fill="rgba(56,189,248,.10)" stroke="#38bdf8" stroke-width="1.5"/><circle cx="20" cy="20" r="11" fill="rgba(56,189,248,.12)" stroke="#38bdf8" stroke-width="1.5"/><line x1="20" y1="20" x2="20" y2="12" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/><line x1="20" y1="20" x2="26" y2="20" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="20" r="1.5" fill="#38bdf8"/><line x1="20" y1="9.5" x2="20" y2="11" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/><line x1="30.5" y1="20" x2="29" y2="20" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/><line x1="20" y1="30.5" x2="20" y2="29" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/><line x1="9.5" y1="20" x2="11" y2="20" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/></svg>')+
      '<div style="flex:1;">'+
        '<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:1px;">'+label+'</div>'+
        '<div style="font-size:23px;font-weight:800;color:'+col+';">'+timeStr+'</div>'+
        '<div style="font-size:12px;color:var(--muted);">'+subStr+'</div>'+
      '</div>'+
      (isNowOpen&&nextWin?
        '<div style="text-align:right;flex-shrink:0;">'+
          '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;">Also ahead</div>'+
          '<div style="font-size:13px;font-weight:600;color:var(--accent);">'+pad(nextWin.start.getHours())+':00 – '+pad(new Date(nextWin.end.getTime()+3600000).getHours())+':00</div>'+
        '</div>':'')+
    '</div>';
  }
  var legend='<div style="display:flex;gap:12px;margin-top:6px;font-size:11px;color:var(--muted);">'+
    '<span><span style="display:inline-block;width:10px;height:10px;background:#22c55e;border-radius:2px;vertical-align:middle;margin-right:3px;"></span>Good</span>'+
    '<span><span style="display:inline-block;width:10px;height:10px;background:#f59e0b;border-radius:2px;vertical-align:middle;margin-right:3px;"></span>Caution</span>'+
    '<span><span style="display:inline-block;width:10px;height:10px;background:#ef4444;border-radius:2px;vertical-align:middle;margin-right:3px;"></span>Avoid</span>'+
    '<span><span class="legend-no-data" style="display:inline-block;width:10px;height:10px;background:#334155;border-radius:2px;vertical-align:middle;margin-right:3px;"></span>No data</span>'+
    '</div>';
  return '<div class="card" id="flight-window-card">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'+
      '<h2 class="card-ttl" style="margin-bottom:0;">Best Flight Window</h2>'+
      (primaryWin?'<button onclick="shareFlightWindow()" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:var(--radius-sm);padding:5px 10px;color:var(--text);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:5px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>Share</button>':'')+
    '</div>'+
    mainHtml+
    '<div style="font-size:11px;color:var(--muted);margin-bottom:2px;text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;justify-content:space-between;">'+(isPro()?'Next 72 hours':'Next 6 hours')+(isPro()?'':'<button onclick="openProOverlay()" style="font-size:10px;font-weight:700;color:#f59e0b;background:none;border:none;cursor:pointer;font-family:inherit;padding:0;text-transform:none;letter-spacing:0;">72h with Pro →</button>')+'</div>'+
    hourStrip+legend+'</div>';
}
// ── Dashboard render state: scroll/focus preservation + redundant-render guard ──
var _lastDashSig=null;
function _dashScroller(){
  var n=document.getElementById('dash');
  while(n&&n!==document.body){var s=getComputedStyle(n);if(/(auto|scroll)/.test(s.overflowY)&&n.scrollHeight>n.clientHeight)return n;n=n.parentElement;}
  var dash=document.getElementById('dash');return dash?dash.parentElement:null;
}
function _dashSignature(){
  var c=(wxData&&wxData.current)?wxData.current:{};
  var th=getThresholds()||{};var cs=getChecklistSummary();var d=getDrone()||{};
  var more='';try{more=localStorage.getItem('dc_more_cond')||'';}catch(e){}
  return [unitMode,tempMode,isPro()?1:0,d.id,th.windAmber,th.windRed,th.gustAmber,th.gustRed,
    currentKp,lastUpdated?lastUpdated.getTime():0,cs.done,cs.total,uLat,uLng,new Date().getHours(),more,
    c.temperature_2m,c.apparent_temperature,c.wind_speed_10m,c.wind_gusts_10m,c.visibility,c.weather_code,
    c.cloud_cover,c.relative_humidity_2m,c.surface_pressure,c.wind_direction_10m,c.wind_speed_80m,c.wind_speed_120m].join('|');
}
function _captureDashFocus(){
  var dash=document.getElementById('dash'),a=document.activeElement;
  if(!dash||!a||!dash.contains(a))return null;
  var info={tag:a.tagName,id:a.id||null,label:(a.getAttribute&&a.getAttribute('aria-label'))||null,text:(a.textContent||'').trim().slice(0,40)};
  if(typeof a.selectionStart==='number'){try{info.selStart=a.selectionStart;info.selEnd=a.selectionEnd;}catch(e){}}
  return info;
}
function _restoreDashFocus(info){
  if(!info)return;var dash=document.getElementById('dash');if(!dash)return;
  var el=info.id?document.getElementById(info.id):null;
  if(!el){var nodes=dash.querySelectorAll(info.tag);for(var i=0;i<nodes.length;i++){var n=nodes[i];
    if(info.label){if(n.getAttribute('aria-label')===info.label){el=n;break;}}
    else if(info.text){if((n.textContent||'').trim().slice(0,40)===info.text){el=n;break;}}}}
  if(el){try{el.focus({preventScroll:true});if(info.selStart!=null&&typeof el.selectionStart==='number')el.setSelectionRange(info.selStart,info.selEnd);}catch(e){}}
}
function _writeDash(html){
  var scroller=_dashScroller();var savedTop=scroller?scroller.scrollTop:0;var focus=_captureDashFocus();
  document.getElementById('dash').innerHTML=html;
  if(scroller)scroller.scrollTop=savedTop;
  _restoreDashFocus(focus);
}
function renderWeatherCard(){
  if(!wxData||!wxData.current)return '';
  var c=wxData.current,wind=c.wind_speed_10m||0,gust=c.wind_gusts_10m||0,vis=c.visibility||10000,wmo=c.weather_code||0;
  var rawTemp=c.temperature_2m||15,rawWind=c.wind_speed_10m||0,rawGust=c.wind_gusts_10m||0;
  var wind80=c.wind_speed_80m||0,wind120=c.wind_speed_120m||0;
  var info=wmoInfo(wmo),cond=flyRating(wind,gust,vis,wmo,currentKp,rawTemp,wind80,wind120);
  var temp=Math.round(rawTemp),feels=Math.round(c.apparent_temperature),cloud=c.cloud_cover||0,hum=c.relative_humidity_2m,pres=Math.round(c.surface_pressure||0);
  var rWind=tileWind(wind),rGust=tileGust(gust),rVis=tileVis(vis),rCloud=tileCloud(cloud),rHum=tileHum(hum),rPres=tilePres(pres),rTemp=tileTemp(rawTemp);
  // Dew point (Magnus approximation — accurate to ±0.5°C for RH 50–100%)
  var dewPoint=Math.round(rawTemp-((100-hum)/5));
  var dewSpread=rawTemp-dewPoint;
  // Cloud base estimate (Lawrence formula): every 1°C spread ≈ 125m AGL
  var cloudBaseM=Math.max(0,Math.round((rawTemp-dewPoint)*125));
  var cloudBaseFt=Math.round(cloudBaseM*3.281);
  var rCloudBase=tileCloudBase(cloudBaseM);
  // Density altitude: ICAO standard atmosphere formula
  var _paFt=(1-Math.pow(pres/1013.25,0.190284))*145366.45;
  var _isaTemp=15-(_paFt/1000)*1.98;
  var densityAltFt=Math.round(_paFt+118.8*(rawTemp-_isaTemp));
  var densityAltM=Math.round(densityAltFt*0.3048);
  var rDensityAlt=tileDensityAlt(densityAltM);
  // Get current hour precipitation probability from hourly data
  var curPrecip=0;
  if(wxData.hourly&&wxData.hourly.precipitation_probability){
    var _nowSlot2=Math.floor(Date.now()/3600000);
    for(var pi=0;pi<wxData.hourly.time.length;pi++){
      if(Math.floor(locEntryMs(wxData.hourly.time[pi])/3600000)===_nowSlot2){curPrecip=Math.round(wxData.hourly.precipitation_probability[pi]||0);break;}
    }
  }
  var rPrecip=tilePrecip(curPrecip);
  var PRECIP_WMO_CODES=[51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99];
  var wxDesc=PRECIP_WMO_CODES.indexOf(wmo)!==-1&&curPrecip<10?(cloud>=90?'Overcast':cloud>=70?'Mostly cloudy':cloud>=30?'Partly cloudy':'Mainly clear'):info.desc;
  var condDesc=qualifyPrecipDesc(cond.desc,curPrecip);
  var vDisp=visDisp(vis);
  var tPrimary=tempMode==='f'?Math.round(rawTemp*9/5+32)+'°F':Math.round(rawTemp)+'°C';
  var tSecondary=tempMode==='f'?Math.round(rawTemp)+'°C':Math.round(rawTemp*9/5+32)+'°F';
  var fPrimary=tempMode==='f'?Math.round(c.apparent_temperature*9/5+32)+'°F':Math.round(c.apparent_temperature)+'°C';
  var fSecondary=tempMode==='f'?Math.round(c.apparent_temperature)+'°C':Math.round(c.apparent_temperature*9/5+32)+'°F';
  var updTxt=lastUpdated?'Updated '+timeSince(lastUpdated):'Loading...';
  var updEl=document.getElementById('updated-txt');if(updEl)updEl.textContent=updTxt;
  // Battery cold-weather range reduction estimate
  // LiPo cells lose ~5% capacity per °C below 10°C (empirical approximation)
  // 2.5% per °C below 10°C, capped at 50% — matches real-world LiPo data
  var battReduction=rawTemp<10?Math.min(Math.round((10-rawTemp)*2.5),50):0;
  var lipoWarnInner=rawTemp<10?
    '<div style="flex:1;min-width:0;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:var(--radius-sm);padding:10px 12px;display:flex;align-items:flex-start;gap:8px;">'+
    '<span style="font-size:16px;">🔋</span>'+
    '<div style="font-size:12px;color:var(--amber);line-height:1.4;">'+(rawTemp<0?'<strong>Below freezing ('+Math.round(rawTemp)+'°C)</strong> — LiPo batteries at serious risk. Warm indoors before take-off. Expect <strong>~'+battReduction+'% reduced range</strong>.':battReduction<10?'<strong>Cool conditions ('+Math.round(rawTemp)+'°C)</strong> — minor battery impact (~'+battReduction+'% reduced range). No action needed.':'<strong>Cold conditions ('+Math.round(rawTemp)+'°C)</strong> — expect ~<strong>'+battReduction+'% reduced battery range</strong>. Warm battery before flight and plan shorter flights.')+'</div>'+
    '</div>':'';
  var nightWarnInner='';
  if(uLat&&uLng){
    var now=new Date(),sunT=calcSunTimes(uLat,uLng,now);
    if(sunT.sunrise&&sunT.sunset&&(now<sunT.sunrise||now>sunT.sunset)){
      nightWarnInner='<div style="flex:1;min-width:0;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);border-radius:var(--radius-sm);padding:10px 12px;display:flex;align-items:flex-start;gap:8px;">'+
        '<span style="font-size:16px;">🟢</span>'+
        '<div style="font-size:12px;color:var(--green);line-height:1.5;"><strong>Night flying</strong> — green flashing light must be active at all times (UK law). '+
        '<span style="color:var(--muted);">If your drone has no built-in light, fit a retrofit before take-off. Note: some drones switch lights off when recording — this makes the flight non-compliant. Always check the latest guidance: </span>'+
        '<a href="https://www.caa.co.uk/drones/getting-started-with-drones-and-model-aircraft/flying-at-night-in-the-open-category/" target="_blank" rel="noopener noreferrer" style="color:var(--accent);white-space:nowrap;">CAA night flying guidance →</a></div>'+
      '</div>';
    }
  }
  var warningsRow=(lipoWarnInner||nightWarnInner)?'<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">'+lipoWarnInner+nightWarnInner+'</div>':'';
  return (
    '<div class="card" id="weather-card"><h2 class="card-ttl">Current Weather</h2><div class="wx-hero"><span class="wx-icon">'+info.emoji+'</span><div><div class="wx-temp">'+tPrimary+' <span style="font-size:22px;font-weight:600;color:var(--muted);">/ '+tSecondary+'</span></div><div class="wx-desc">'+wxDesc+' &middot; feels '+fPrimary+' / '+fSecondary+'</div></div></div>'+
    '<div class="wx-grid">'+
    '<div class="wx-tile '+rWind+'"><div class="wx-lbl"><span>Wind</span><button class="wx-info-btn" onclick="toggleTileInfo(this)" aria-label="About Wind"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><rect x="7.25" y="6.5" width="1.5" height="5" rx=".75" fill="currentColor"/><rect x="7.25" y="4" width="1.5" height="1.5" rx=".75" fill="currentColor"/></svg></button></div><div class="wx-val wx-val-'+rWind+'">'+spd(wind)+' <span style="font-size:11px;font-weight:400;">'+spdU()+'</span></div><div class="wx-sub">'+dirLabel(c.wind_direction_10m||0)+' &middot; '+(wind*0.54).toFixed(1)+' kt</div><div class="wx-info-panel">Wind speed at 10m above ground. This directly determines whether your drone can hold position and return home safely. Above your drone\'s rated limit it may struggle to resist being pushed sideways or downwind.</div></div>'+
    '<div class="wx-tile '+rGust+'"><div class="wx-lbl"><span>Gusts</span><button class="wx-info-btn" onclick="toggleTileInfo(this)" aria-label="About Gusts"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><rect x="7.25" y="6.5" width="1.5" height="5" rx=".75" fill="currentColor"/><rect x="7.25" y="4" width="1.5" height="1.5" rx=".75" fill="currentColor"/></svg></button></div><div class="wx-val wx-val-'+rGust+'">'+spd(gust)+' <span style="font-size:11px;font-weight:400;">'+spdU()+'</span></div><div class="wx-sub">'+(gust>=getDrone().gustRed?'Too strong':'Within limits')+'</div><div class="wx-info-panel">Sudden bursts above the average wind speed, measured at 10m above ground — more dangerous than steady wind. A single gust can disorient or flip a drone before you can react. DroneChecker\'s amber and red thresholds are calibrated to your drone\'s published gust tolerance.</div></div>'+
    '<div class="wx-tile '+rVis+'"><div class="wx-lbl"><span>Visibility</span><button class="wx-info-btn" onclick="toggleTileInfo(this)" aria-label="About Visibility"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><rect x="7.25" y="6.5" width="1.5" height="5" rx=".75" fill="currentColor"/><rect x="7.25" y="4" width="1.5" height="1.5" rx=".75" fill="currentColor"/></svg></button></div><div class="wx-val wx-val-'+rVis+'">'+vDisp.val+' <span style="font-size:11px;font-weight:400;">'+vDisp.unit+'</span></div><div class="wx-sub">'+(vis>=5000?'Good VLOS':'Reduced VLOS')+'</div><div class="wx-info-panel">How far you can see horizontally. UK CAA rules require keeping your drone within visual line of sight (VLOS) at all times — close enough to see its orientation and react to hazards without visual aids. Poor visibility makes legal, safe flight impossible.</div></div>'+
    '<div class="wx-tile '+rCloud+'"><div class="wx-lbl"><span>Cloud Cover</span><button class="wx-info-btn" onclick="toggleTileInfo(this)" aria-label="About Cloud Cover"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><rect x="7.25" y="6.5" width="1.5" height="5" rx=".75" fill="currentColor"/><rect x="7.25" y="4" width="1.5" height="1.5" rx=".75" fill="currentColor"/></svg></button></div><div class="wx-val wx-val-'+rCloud+'">'+cloud+'<span style="font-size:11px;font-weight:400;">%</span></div><div class="wx-sub">'+(cloud<30?'Clear':cloud<70?'Partial':'Overcast')+'</div><div class="wx-info-panel">Percentage of sky covered by cloud. You must maintain visual line of sight at all times, so flying into cloud is not permitted — you would instantly lose sight of the drone. Heavy overcast also reduces light for photography and can signal worsening conditions.</div></div>'+
    '<div class="wx-tile '+rPrecip+'"><div class="wx-lbl"><span>Precipitation</span><button class="wx-info-btn" onclick="toggleTileInfo(this)" aria-label="About Precipitation"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><rect x="7.25" y="6.5" width="1.5" height="5" rx=".75" fill="currentColor"/><rect x="7.25" y="4" width="1.5" height="1.5" rx=".75" fill="currentColor"/></svg></button></div><div class="wx-val wx-val-'+rPrecip+'">'+curPrecip+'<span style="font-size:11px;font-weight:400;">%</span></div><div class="wx-sub">'+(curPrecip>=60?'High chance':curPrecip>=50?'Moderate chance':curPrecip>0?'Low chance':'Unlikely')+'</div><div class="wx-info-panel">Probability of precipitation in the current hour. Above 50% consider whether your drone has water resistance. Above 70% flying is not advisable — even light rain can cause water ingress and damage electronics or motors on most consumer drones.</div></div>'+
    (function(){var kp=currentKp;var kc=kp>=6?'red':kp>=4?'amber':'green';var klab=kp>=6?'Severe Storm':kp>=5?'Moderate Storm':kp>=4?'Minor Storm':kp>=2?'Unsettled':'Quiet';return'<div class="wx-tile '+rHum+'"><div class="wx-lbl"><span>Humidity</span><button class="wx-info-btn" onclick="toggleTileInfo(this)" aria-label="About Humidity"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><rect x="7.25" y="6.5" width="1.5" height="5" rx=".75" fill="currentColor"/><rect x="7.25" y="4" width="1.5" height="1.5" rx=".75" fill="currentColor"/></svg></button></div><div class="wx-val wx-val-'+rHum+'">'+hum+'<span style="font-size:11px;font-weight:400;">%</span></div><div class="wx-sub">'+(hum>90?'Condensation risk':hum>75?'High humidity':'Normal')+'</div><div class="wx-info-panel">Moisture content of the air. Above 75%, humidity starts to affect sensors and cameras. Above 80–90%, condensation forms readily on electronics — causing lens fog, sensor errors and corrosion. Most consumer drones have no moisture protection at all.</div></div>'+
    '<div class="wx-tile '+rPres+'"><div class="wx-lbl"><span>Pressure</span><button class="wx-info-btn" onclick="toggleTileInfo(this)" aria-label="About Pressure"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><rect x="7.25" y="6.5" width="1.5" height="5" rx=".75" fill="currentColor"/><rect x="7.25" y="4" width="1.5" height="1.5" rx=".75" fill="currentColor"/></svg></button></div><div class="wx-val wx-val-'+rPres+'" style="font-size:16px;">'+pres+'</div><div class="wx-sub">'+(pres<980?'Very low':pres<1000?'Low':'Normal')+' hPa</div><div class="wx-info-panel">Atmospheric pressure at ground level. Drones use a barometric sensor to hold altitude — rapid pressure changes during flight can cause unexpected altitude drift. Low or falling pressure also signals approaching weather fronts, stronger winds and deteriorating conditions.</div></div>'+
    '<div class="wx-tile '+rTemp+'"><div class="wx-lbl"><span>Dew Point</span><button class="wx-info-btn" onclick="toggleTileInfo(this)" aria-label="About Dew Point"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><rect x="7.25" y="6.5" width="1.5" height="5" rx=".75" fill="currentColor"/><rect x="7.25" y="4" width="1.5" height="1.5" rx=".75" fill="currentColor"/></svg></button></div><div class="wx-val wx-val-'+rTemp+'">'+dewPoint+'°C</div><div class="wx-sub">'+(dewSpread<2?'⚠ Condensation risk':dewSpread<4?'Watch for dew':'Low dew risk')+'</div><div class="wx-info-panel">The temperature at which moisture condenses into liquid. Within 2–3°C of dew point, condensation forms on your drone\'s cold lens, sensors and motor housings — even on a dry-feeling day.</div></div>'+
    '</div>';
})()+

    '<div class="wx-grid" style="margin-top:8px;">'+
    (function(){var ratio=rawWind>0?(rawGust-rawWind)/rawWind:0;var r=ratio>=0.75?'red':ratio>=0.35?'amber':'green';var col=r==='red'?'var(--red)':r==='amber'?'var(--amber)':'var(--green)';var lbl=ratio>=0.75?'Turbulent':ratio>=0.35?'Choppy':'Smooth';var desc=ratio>=0.75?'Large gust spikes — difficult to control':ratio>=0.35?'Moderate variation — fly with care':'Steady air — good flying conditions';return'<div class="wx-tile wx-tile-smooth '+r+'"><div class="wx-lbl"><span>Air Smoothness</span><button class="wx-info-btn" onclick="toggleTileInfo(this)" aria-label="About Air Smoothness"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><rect x="7.25" y="6.5" width="1.5" height="5" rx=".75" fill="currentColor"/><rect x="7.25" y="4" width="1.5" height="1.5" rx=".75" fill="currentColor"/></svg></button></div><div class="wx-val wx-val-'+r+'">'+lbl+'</div><div class="wx-sub">'+desc+'</div><div class="wx-info-panel">The ratio of gust speed to average wind. Turbulent, gusty air means unpredictable handling and jerky footage even within safe wind speed limits. Smooth, steady air is always preferable to gusty air of the same average speed.</div></div>';})()+
    (function(){var kp=currentKp;var kc=kp>=6?'red':kp>=4?'amber':'green';var klab=kp>=6?'Severe Storm':kp>=5?'Moderate Storm':kp>=4?'Minor Storm':kp>=2?'Unsettled':'Quiet';return'<div class="wx-tile '+kc+'"><div class="wx-lbl"><span>KP Index</span><button class="wx-info-btn" onclick="toggleTileInfo(this)" aria-label="About KP Index"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><rect x="7.25" y="6.5" width="1.5" height="5" rx=".75" fill="currentColor"/><rect x="7.25" y="4" width="1.5" height="1.5" rx=".75" fill="currentColor"/></svg></button></div><div class="wx-val wx-val-'+kc+'">'+kp.toFixed(1)+'</div><div class="wx-sub">'+klab+'</div><div class="wx-info-panel">The planetary K-index measures geomagnetic storm activity. Above KP 4, GPS accuracy can be reduced and compass drift may occur. Above KP 6, flying is not recommended. Data updates every few minutes from NOAA.</div></div>';})()+

    '<div class="wx-tile wx-tile-wide" style="grid-column:1/-1;"><div class="wx-lbl"><span>Wind at Altitude</span><button class="wx-info-btn" onclick="toggleTileInfo(this)" aria-label="About Wind at Altitude"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><rect x="7.25" y="6.5" width="1.5" height="5" rx=".75" fill="currentColor"/><rect x="7.25" y="4" width="1.5" height="1.5" rx=".75" fill="currentColor"/></svg></button></div><div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">'+
    (function(){var d=getDrone(),rows='',levels=[{h:'120m',v:wind120},{h:'80m',v:wind80},{h:'10m',v:rawWind}];levels.forEach(function(l){var r=l.v>=d.windRed?'red':l.v>=d.windAmber?'amber':'green';var col=r==='red'?'#ef4444':r==='amber'?'#f59e0b':'#22c55e';var pct=Math.min(Math.round((l.v/d.windRed)*100),100);rows+='<div style="display:flex;align-items:center;gap:6px;"><div style="font-size:10px;color:var(--muted);width:28px;flex-shrink:0;">'+l.h+'</div><div style="flex:1;background:var(--bg);border-radius:3px;height:4px;overflow:hidden;"><div style="width:'+pct+'%;height:100%;background:'+col+';border-radius:3px;"></div></div><div style="font-size:12px;font-weight:600;color:'+col+';flex-shrink:0;min-width:44px;text-align:right;">'+spd(l.v)+' '+spdU()+'</div></div>';});return rows;})()+'</div><div class="wx-info-panel">Wind speed typically increases with height as surface friction reduces. Ground conditions can feel calm while your drone faces much stronger winds at 80–120m. Always check altitude readings before climbing, especially near trees or obstacles.</div></div>'+
    '</div>'+warningsRow+
    '<div id="more-cond-toggle" onclick="toggleMoreConditions()" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:14px 0 10px;cursor:pointer;user-select:none;"><span id="more-cond-label" style="font-size:12px;font-weight:600;color:var(--muted);">More conditions</span><span id="more-cond-chevron" style="font-size:11px;color:var(--muted);transition:transform .2s;">&#9662;</span></div>'+
    '<div id="more-cond-body" style="display:none;"><div class="wx-grid" style="margin-bottom:8px;">'+
    '<div class="wx-tile '+rCloudBase+'"><div class="wx-lbl"><span>Cloud Base</span><button class="wx-info-btn" onclick="toggleTileInfo(this)" aria-label="About Cloud Base"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><rect x="7.25" y="6.5" width="1.5" height="5" rx=".75" fill="currentColor"/><rect x="7.25" y="4" width="1.5" height="1.5" rx=".75" fill="currentColor"/></svg></button></div><div class="wx-val wx-val-'+rCloudBase+'">'+cloudBaseM+'<span style="font-size:11px;font-weight:400;">m</span> <span style="font-size:11px;font-weight:400;color:var(--muted);">/ '+cloudBaseFt+'ft</span></div><div class="wx-sub">'+(rCloudBase==='red'?'✕ Below 120m — legal ceiling':rCloudBase==='amber'?'⚠ Low ceiling — caution':'Clear above 150m')+'</div><div class="wx-info-panel">Estimated altitude where cloud forms, derived from temperature and dew point. UK drone rules require staying below cloud at all times — entering cloud is not permitted and removes visual contact. Below 150m cloud base leaves very little usable sky. Below 120m flying is effectively prohibited — cloud and legal ceiling coincide.</div></div>'+
    (function(){var _gq=gpsQuality(currentKp,new Date().getHours());var _gc=_gq.col,_gl=_gq.label,_gs=_gq.sub;return'<div class="wx-tile '+_gc+'"><div class="wx-lbl"><span>GPS Accuracy</span><button class="wx-info-btn" onclick="toggleTileInfo(this)" aria-label="About GPS Accuracy"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><rect x="7.25" y="6.5" width="1.5" height="5" rx=".75" fill="currentColor"/><rect x="7.25" y="4" width="1.5" height="1.5" rx=".75" fill="currentColor"/></svg></button></div><div class="wx-val wx-val-'+_gc+'">'+_gl+'</div><div class="wx-sub">'+_gs+'</div><div class="wx-info-panel">Estimated GPS positioning accuracy based on geomagnetic activity (KP index) and time of day. Elevated KP causes ionospheric scintillation — phase errors in satellite signals that reduce accuracy and can cause compass drift. This is independent of how many satellites your drone can see. At KP 4+ avoid autonomous modes (Return-to-Home, Waypoints). At KP 6+ GPS-dependent flight is not recommended.</div></div>';})()+
    '<div class="wx-tile '+rDensityAlt+'"><div class="wx-lbl"><span>Density Alt</span><button class="wx-info-btn" onclick="toggleTileInfo(this)" aria-label="About Density Altitude"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><rect x="7.25" y="6.5" width="1.5" height="5" rx=".75" fill="currentColor"/><rect x="7.25" y="4" width="1.5" height="1.5" rx=".75" fill="currentColor"/></svg></button></div><div class="wx-val wx-val-'+rDensityAlt+'">'+densityAltM+'<span style="font-size:11px;font-weight:400;">m</span> <span style="font-size:11px;font-weight:400;color:var(--muted);">/ '+densityAltFt+'ft</span></div><div class="wx-sub">'+(rDensityAlt==='red'?'✕ Very thin air — reduced lift':rDensityAlt==='amber'?'⚠ Thinner air — monitor performance':'Normal air density')+'</div><div class="wx-info-panel">How hard your drone\'s motors must work to generate lift, combining the effects of altitude and temperature. Hot or low-pressure air is less dense — motors spin faster and batteries drain quicker for the same lift. Above 1000m density altitude expect noticeable performance reduction; above 2000m you are approaching the ceiling of most consumer drones.</div></div>'+
    '</div></div>'+
    '</div>'
  );
}
function renderDash(){
  if(!wxData||!wxData.current){
    _lastDashSig=null;
    var dashEl=document.getElementById('dash');
    if(dashEl&&dashEl.querySelector('.skel'))dashEl.innerHTML=
      '<div class="err">Could not load weather data. Check your connection and try again.<br><br>'+
      '<button onclick="fetchAll()" style="background:var(--accent);border:none;border-radius:var(--radius-sm);padding:10px 20px;color:#020617;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">↻ Try Again</button></div>';
    return;
  }
  var _sig=_dashSignature();
  if(_sig===_lastDashSig)return;
  _lastDashSig=_sig;
  // Weather values for the rest of the dashboard are owned by renderWeatherCard();
  // renderDash only needs the fly rating (cond strip + a11y) and the header timestamp.
  var c=wxData.current,wind=c.wind_speed_10m||0,gust=c.wind_gusts_10m||0,vis=c.visibility||10000,wmo=c.weather_code||0;
  var rawTemp=c.temperature_2m||15,wind80=c.wind_speed_80m||0,wind120=c.wind_speed_120m||0;
  var cond=flyRating(wind,gust,vis,wmo,currentKp,rawTemp,wind80,wind120);
  var curPrecip=0;
  if(wxData.hourly&&wxData.hourly.precipitation_probability){
    var _nowSlot2=Math.floor(Date.now()/3600000);
    for(var pi=0;pi<wxData.hourly.time.length;pi++){
      if(Math.floor(locEntryMs(wxData.hourly.time[pi])/3600000)===_nowSlot2){curPrecip=Math.round(wxData.hourly.precipitation_probability[pi]||0);break;}
    }
  }
  var condDesc=qualifyPrecipDesc(cond.desc,curPrecip);
  var updTxt=lastUpdated?'Updated '+timeSince(lastUpdated):'Loading...';
  var updEl=document.getElementById('updated-txt');if(updEl)updEl.textContent=updTxt;
  _writeDash(
    '<div class="cond '+cond.lvl+'"><div class="cond-ring '+cond.lvl+'">'+DRONE_SVG+'</div><div style="flex:1;"><div class="cond-lbl '+cond.lvl+'">'+cond.label+'</div><div class="cond-desc">'+condDesc+'</div></div><button onclick="shareConditions()" style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:var(--radius-sm);padding:6px 10px;color:var(--text);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;display:flex;align-items:center;gap:5px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>Share</button></div>'+
    renderIdReminderBanner()+
    renderBestTimeCard()+renderFlightWindowCard()+
    proUpsellStrip()+
    renderWeatherCard()+
    '<div class="card" style="cursor:pointer;" onclick="openChecklist()"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><h2 class="card-ttl" style="margin-bottom:0;">Pre-flight Checklist</h2><span style="font-size:12px;color:var(--accent);font-weight:600;">View →</span></div><div class="cl-progress"><div class="cl-progress-bar" id="dash-cl-bar" style="width:'+getChecklistSummary().pct+'%;"></div></div><div style="display:flex;justify-content:space-between;margin-top:6px;font-size:12px;color:var(--muted);"><span id="dash-cl-count">'+getChecklistSummary().done+' / '+getChecklistSummary().total+' complete</span>'+(getChecklistSummary().done===getChecklistSummary().total?'<span id="dash-cl-remaining" style="color:var(--green);">✓ All done</span>':'<span id="dash-cl-remaining">'+(getChecklistSummary().total-getChecklistSummary().done)+' remaining</span>')+'</div></div>'+
    '<div class="card" style="cursor:pointer;" onclick="openRules()"><div style="display:flex;align-items:center;justify-content:space-between;"><h2 class="card-ttl" style="margin-bottom:0;">UK Drone Law &amp; Rules</h2><span style="font-size:12px;color:var(--accent);font-weight:600;">View &#8594;</span></div><div style="font-size:12px;color:var(--muted);margin-top:6px;">2026 Updates &amp; Restrictions</div></div>'+
    '<div class="card"><div class="nats-card"><div style="font-size:28px;">🛩️</div><div style="flex:1;"><div style="font-size:13px;font-weight:600;margin-bottom:3px;color:var(--text);">CAA Drone Safety</div><div style="font-size:12px;color:var(--muted);line-height:1.5;">Official UK drone rules, registration and airspace information.</div></div><a href="https://www.caa.co.uk/drones" target="_blank" rel="noopener noreferrer">Open →</a></div></div>'+
    '<div style="margin:20px 12px 0;padding:16px;border-top:1px solid var(--border);text-align:center;">'+
    (!isIOS&&!isStandalone?'<div style="display:inline-block;margin-bottom:16px;position:relative;opacity:.5;cursor:default;"><img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Get it on Google Play" style="height:48px;"/><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(15,23,42,.85);border:1px solid rgba(255,255,255,.15);border-radius:6px;padding:3px 10px;font-size:11px;font-weight:600;color:#f1f5f9;white-space:nowrap;backdrop-filter:blur(4px);">Coming Soon</div></div>':'')+
    (isIOS&&!isStandalone?
      '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px;text-align:left;">'+
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'+
      '<span style="font-size:28px;">📲</span>'+
      '<div><div style="font-size:13px;font-weight:600;color:var(--text);">Add to iPhone Home Screen</div>'+
      '<div style="font-size:12px;color:var(--muted);">Install DroneChecker as an app — no App Store needed</div></div></div>'+
      '<div style="font-size:12px;color:var(--muted);line-height:2;">'+
      '1️⃣&nbsp; Tap the <strong style="color:var(--text);">Share</strong> button <strong style="color:var(--text);">⎋</strong> at the bottom of Safari<br>'+
      '2️⃣&nbsp; Scroll down and tap <strong style="color:var(--text);">Add to Home Screen</strong><br>'+
      '3️⃣&nbsp; Tap <strong style="color:var(--text);">Add</strong> — done!'+
      '</div></div>'
    :'')+
    '<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;">'+
    '<a href="/faq.html" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:var(--muted);text-decoration:none;">FAQ</a>'+
    '<span style="font-size:12px;color:var(--border);">|</span>'+
    '<a href="/privacy.html" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:var(--muted);text-decoration:none;">Privacy Policy</a>'+
    '<span style="font-size:12px;color:var(--border);">|</span>'+
    '<a href="/terms.html" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:var(--muted);text-decoration:none;">Terms of Service</a>'+
    '<span style="font-size:12px;color:var(--border);">|</span>'+
    '<a href="'+buildFeedbackMailto()+'" style="font-size:12px;color:var(--muted);text-decoration:none;">Send Feedback</a>'+
    '<span style="font-size:12px;color:var(--border);">|</span>'+
    '<a href="#" onclick="resetAllData();return false;" style="font-size:12px;color:var(--muted);text-decoration:none;">Reset Data</a>'+
    '</div>'+
    proAccountCard()+'<div style="font-size:11px;color:var(--border);margin-top:8px;">v'+APP_VERSION+'</div>'+
    '</div><div style="height:14px;"></div>');
  var announcer=document.getElementById('a11y-announce');
  if(announcer)announcer.textContent=cond.label+'. '+condDesc;
  initMoreConditions();
}
function timeSince(date){
  var mins=Math.floor((new Date()-date)/60000);
  if(mins<1)return'just now';
  if(mins<60)return mins+' min'+(mins!==1?'s':'')+' ago';
  var hrs=Math.floor(mins/60);return hrs+' hr'+(hrs!==1?'s':'')+' ago';
}
function buildFcHourDetail(wind,gust,vis,wmo,rawTemp,w80,w120,precip,kpVal){
  var rating=flyRating(wind,gust,vis,wmo,kpVal,rawTemp,w80,w120);
  var rWind=tileWind(wind),rGust=tileGust(gust),rVis=tileVis(vis);
  var precipColor=precip>=60?'red':precip>=30?'amber':'green';
  var ratio=wind>0?(gust-wind)/wind:0;
  var rSmooth=ratio>=0.75?'red':ratio>=0.35?'amber':'green';
  var smoothLbl=ratio>=0.75?'Turbulent':ratio>=0.35?'Choppy':'Smooth';
  var rW80=tileWind(w80),rW120=tileWind(w120);
  var vd=visDisp(vis);
  var kpC=kpVal>=6?'red':kpVal>=4?'amber':'green';
  var drone=getDrone();
  function barW(v,limit){return Math.min(Math.round((v/Math.max(limit,1))*100),100)+'%';}
  var altMax=Math.max(wind,w80,w120,drone.windRed,1);
  function altBarW(v){return Math.min(Math.round((v/altMax)*100),100)+'%';}
  return(
    '<div class="fcd-hero">'+
      '<div class="fcd-hero-icon '+rating.lvl+'">'+
        (rating.lvl==='green'?'✓':rating.lvl==='amber'?'⚠':'✕')+
      '</div>'+
      '<div>'+
        '<div class="fcd-hero-lbl '+rating.lvl+'">'+rating.label+'</div>'+
        '<div class="fcd-hero-desc">'+(rating.lvl!=='green'?rating.desc:'Conditions look good for your '+drone.name+'.')+'</div>'+
      '</div>'+
    '</div>'+
    '<div class="fcd-divider"></div>'+
    '<div class="fcd-grid">'+
      // Wind
      '<div class="fcd-tile">'+
        '<div class="fcd-lbl">Wind (10m)</div>'+
        '<div class="fcd-val">'+spd(wind)+'<span> '+spdU()+'</span></div>'+
        '<div class="fcd-sub">'+(rWind==='green'?'Within limits':rWind==='amber'?'Approaching limit':'Exceeds limit')+'</div>'+
        '<div class="fcd-bar-bg"><div class="fcd-bar '+rWind+'" style="width:'+barW(wind,drone.windRed)+';"></div></div>'+
      '</div>'+
      // Gusts
      '<div class="fcd-tile">'+
        '<div class="fcd-lbl">Gusts</div>'+
        '<div class="fcd-val">'+spd(gust)+'<span> '+spdU()+'</span></div>'+
        '<div class="fcd-sub">'+(rGust==='green'?'Stable':rGust==='amber'?'Moderate':'Strong')+'</div>'+
        '<div class="fcd-bar-bg"><div class="fcd-bar '+rGust+'" style="width:'+barW(gust,drone.gustRed)+';"></div></div>'+
      '</div>'+
      // Air smoothness
      '<div class="fcd-tile">'+
        '<div class="fcd-lbl">Air Smoothness</div>'+
        '<div class="fcd-val">'+smoothLbl+'</div>'+
        '<div class="fcd-sub">'+(rSmooth==='green'?'Steady — great for footage':rSmooth==='amber'?'Some variation — fly with care':'Gusty — expect jerky footage')+'</div>'+
        '<div class="fcd-bar-bg"><div class="fcd-bar '+rSmooth+'" style="width:'+(ratio>=0.75?'100':ratio>=0.35?'55':'20')+'%;"></div></div>'+
      '</div>'+
      // Rain
      '<div class="fcd-tile">'+
        '<div class="fcd-lbl">Rain Chance</div>'+
        '<div class="fcd-val">'+precip+'<span>%</span></div>'+
        '<div class="fcd-sub">'+(precip>=70?'Avoid flying':precip>=50?'High — stay grounded':precip>=30?'Moderate — be cautious':precip>0?'Low chance':'Unlikely')+'</div>'+
        '<div class="fcd-bar-bg"><div class="fcd-bar '+precipColor+'" style="width:'+precip+'%;"></div></div>'+
      '</div>'+
      // Visibility
      '<div class="fcd-tile">'+
        '<div class="fcd-lbl">Visibility</div>'+
        '<div class="fcd-val">'+vd.val+'<span> '+vd.unit+'</span></div>'+
        '<div class="fcd-sub">'+(rVis==='green'?'Clear — no restrictions':rVis==='amber'?'Reduced — stay cautious':'Poor — do not fly')+'</div>'+
        '<div class="fcd-bar-bg"><div class="fcd-bar '+rVis+'" style="width:'+barW(Math.min(vis,10000),10000)+';"></div></div>'+
      '</div>'+
      // KP
      '<div class="fcd-tile">'+
        '<div class="fcd-lbl">KP Index</div>'+
        '<div class="fcd-val">'+kpVal.toFixed(1)+'</div>'+
        '<div class="fcd-sub">'+(kpC==='red'?'GPS unreliable — do not fly':kpC==='amber'?'GPS drift possible — fly with care':kpVal>=2?'Minor geomagnetic activity':'No geomagnetic activity')+'</div>'+
        '<div class="fcd-bar-bg"><div class="fcd-bar '+kpC+'" style="width:'+barW(kpVal,9)+';"></div></div>'+
      '</div>'+
      // Wind at altitude — full width
      '<div class="fcd-tile fcd-tile-wide">'+
        '<div class="fcd-lbl">Wind at Altitude</div>'+
        '<div class="fcd-alt-row">'+
          ['10m','80m','120m'].map(function(h,idx){
            var vals=[wind,w80,w120];var rs=[rWind,rW80,rW120];
            var v=vals[idx];var r=rs[idx];
            return '<div class="fcd-alt-col">'+
              '<div class="fcd-alt-h">'+h+'</div>'+
              '<div class="fcd-alt-v">'+spd(v)+' '+spdU()+'</div>'+
              '<div class="fcd-alt-bar-wrap"><div class="fcd-alt-bar '+r+'" style="width:'+altBarW(v)+';"></div></div>'+
            '</div>';
          }).join('')+
        '</div>'+
      '</div>'+
    '</div>'
  );
}
function toggleFcDetail(idx){
  var clickedItem=document.getElementById('fc-row-'+idx);
  var clickedDetail=document.getElementById('fc-det-'+idx);
  if(!clickedItem||!clickedDetail)return;
  var isOpen=clickedDetail.classList.contains('open');
  if(isOpen){clickedItem.classList.remove('fc-open');clickedDetail.classList.remove('open');}
  else{clickedItem.classList.add('fc-open');clickedDetail.classList.add('open');}
}
function renderFc(){
  if(!wxData||!wxData.hourly)return;
  var hours=wxData.hourly,now=new Date(),rows='',count=0;
  var maxHours=isPro()?72:6;

  // "Now" tile — live current conditions (same source as the Dashboard's
  // condition strip), shown above the hourly list so users don't have to
  // switch tabs to see what it's doing right now.
  if(wxData.current){
    var nc=wxData.current;
    var nWind=nc.wind_speed_10m||0,nGust=nc.wind_gusts_10m||0,nVis=nc.visibility||10000,nWmo=nc.weather_code||0;
    var nRawTemp=nc.temperature_2m||0,nTemp=Math.round(nRawTemp);
    var nW80=nc.wind_speed_80m||0,nW120=nc.wind_speed_120m||0;
    var nPrecip=0;
    if(hours.precipitation_probability){
      var _nowSlot=Math.floor(Date.now()/3600000);
      for(var ni=0;ni<hours.time.length;ni++){
        if(Math.floor(locEntryMs(hours.time[ni])/3600000)===_nowSlot){nPrecip=Math.round(hours.precipitation_probability[ni]||0);break;}
      }
    }
    var nRatingWmo=precipAdjustWmo(nWmo,nPrecip);
    var nInfo=wmoInfo(nWmo,now);
    var nFcTempPrimary=tmp(nRawTemp)+tmpU();
    var nFcTempSecondary=unitMode==='mph'?Math.round(nRawTemp)+'°C':Math.round(nRawTemp*9/5+32)+'°F';
    var nPrecipBadge=nPrecip>0?'<span style="font-size:11px;color:'+(nPrecip>=60?'var(--red)':nPrecip>=30?'var(--amber)':'var(--muted)')+';">💧'+nPrecip+'% rain</span>':'';
    var nRating=flyRating(nWind,nGust,nVis,nRatingWmo,currentKp,nTemp,nW80,nW120);
    var nAriaLabel='Now. '+nInfo.desc+'.'+(nPrecip>0?' '+nPrecip+' percent chance of rain.':'')+' '+spd(nWind)+' '+spdU()+' wind. '+(nRating.lvl==='green'?'Good to fly.':'Caution: '+nRating.desc)+'. Tap for full conditions.';
    rows+=
      '<div class="fc-item" id="fc-row-now" onclick="toggleFcDetail(&apos;now&apos;)" role="button" aria-expanded="false" aria-label="'+nAriaLabel+'" style="border-left:3px solid var(--accent);padding-left:11px;">'+
        '<div class="fc-time" style="color:var(--accent);">Now</div>'+
        '<div class="fc-icon">'+nInfo.emoji+'</div>'+
        '<div class="fc-temp">'+nFcTempPrimary+'<br><span style="font-size:11px;color:var(--muted);">'+nFcTempSecondary+'</span></div>'+
        '<div class="fc-desc">'+nInfo.desc+(nPrecipBadge?' &middot; '+nPrecipBadge:'')+'</div>'+
        (function(){
          var d=getDrone();
          var r10=nWind>=d.windRed?'red':nWind>=d.windAmber?'amber':'green';
          var r80=nW80>=d.windRed?'red':nW80>=d.windAmber?'amber':'green';
          var r120=nW120>=d.windRed?'red':nW120>=d.windAmber?'amber':'green';
          var col10=r10==='red'?'var(--red)':r10==='amber'?'var(--amber)':'var(--green)';
          var col80=r80==='red'?'var(--red)':r80==='amber'?'var(--amber)':'var(--green)';
          var col120=r120==='red'?'var(--red)':r120==='amber'?'var(--amber)':'var(--green)';
          var altWorse=r80!=='green'||r120!=='green';
          if(!altWorse){
            return'<div class="fc-wind"><div style="color:'+col10+';">'+spd(nWind)+' '+spdU()+'</div><div style="font-size:9px;color:#22c55e;opacity:.75;margin-top:2px;">↑ alt ✓</div></div>';
          }
          return'<div class="fc-wind-stack">'+
            '<div class="fc-wind-row"><span class="fc-wind-alt">↑120</span><span class="fc-wind-val" style="color:'+col120+';">'+spd(nW120)+'</span></div>'+
            '<div class="fc-wind-row"><span class="fc-wind-alt">↑80</span><span class="fc-wind-val" style="color:'+col80+';">'+spd(nW80)+'</span></div>'+
            '<div class="fc-wind-row"><span class="fc-wind-alt">↑10</span><span class="fc-wind-val" style="color:'+col10+';">'+spd(nWind)+'</span></div>'+
          '</div>';
        })()+
        '<div class="fc-dot '+nRating.lvl+'"></div>'+
        '<div class="fc-chevron">▾</div>'+
      '</div>'+
      '<div class="fc-detail" id="fc-det-now">'+
        buildFcHourDetail(nWind,nGust,nVis,nRatingWmo,nRawTemp,nW80,nW120,nPrecip,currentKp)+
      '</div>';
  }

  for(var i=0;i<hours.time.length&&count<maxHours;i++){
    var t=new Date(hours.time[i]);if(locEntryMs(hours.time[i])<Date.now())continue;
    var wmo=hours.weather_code[i],info=wmoInfo(wmo,t),wind=hours.wind_speed_10m[i]||0,gust=hours.wind_gusts_10m[i]||0,vis=hours.visibility[i]||10000,temp=Math.round(hours.temperature_2m[i]);
    var w80=hours.wind_speed_80m?hours.wind_speed_80m[i]||0:0;
    var w120=hours.wind_speed_120m?hours.wind_speed_120m[i]||0:0;
    var precip=hours.precipitation_probability?Math.round(hours.precipitation_probability[i]||0):0;
    var ratingWmo=precipAdjustWmo(wmo,precip);
    var rawTempHr=hours.temperature_2m[i]||0;
    var fcTempPrimary=tmp(rawTempHr)+tmpU();
    var fcTempSecondary=unitMode==='mph'?Math.round(rawTempHr)+'°C':Math.round(rawTempHr*9/5+32)+'°F';
    var precipBadge=precip>0?'<span style="font-size:11px;color:'+(precip>=60?'var(--red)':precip>=30?'var(--amber)':'var(--muted)')+';">💧'+precip+'% rain</span>':'';
    var rating=flyRating(wind,gust,vis,ratingWmo,getKpForTime(t),temp,w80,w120);
    var kpVal=getKpForTime(t);
    var ariaLabel=pad(t.getHours())+':00. '+info.desc+'.'+(precip>0?' '+precip+' percent chance of rain.':'')+' '+spd(wind)+' '+spdU()+' wind. '+(rating.lvl==='green'?'Good to fly.':'Caution: '+rating.desc)+'. Tap for full conditions.';
    var dayLabel=t.toDateString()!==now.toDateString()?'<span style="font-size:10px;color:var(--accent);font-weight:600;margin-left:4px;">'+t.toLocaleDateString('en-GB',{weekday:'short'})+'</span>':'';
    rows+=
      '<div class="fc-item" id="fc-row-'+count+'" onclick="toggleFcDetail('+count+')" role="button" aria-expanded="false" aria-label="'+ariaLabel+'">'+
        '<div class="fc-time">'+pad(t.getHours())+':00'+dayLabel+'</div>'+
        '<div class="fc-icon">'+info.emoji+'</div>'+
        '<div class="fc-temp">'+fcTempPrimary+'<br><span style="font-size:11px;color:var(--muted);">'+fcTempSecondary+'</span></div>'+
        '<div class="fc-desc">'+info.desc+(precipBadge?' &middot; '+precipBadge:'')+'</div>'+
        (function(){
          var d=getDrone();
          var r10=wind>=d.windRed?'red':wind>=d.windAmber?'amber':'green';
          var r80=w80>=d.windRed?'red':w80>=d.windAmber?'amber':'green';
          var r120=w120>=d.windRed?'red':w120>=d.windAmber?'amber':'green';
          var col10=r10==='red'?'var(--red)':r10==='amber'?'var(--amber)':'var(--green)';
          var col80=r80==='red'?'var(--red)':r80==='amber'?'var(--amber)':'var(--green)';
          var col120=r120==='red'?'var(--red)':r120==='amber'?'var(--amber)':'var(--green)';
          var altWorse=r80!=='green'||r120!=='green';
          if(!altWorse){
            return'<div class="fc-wind"><div style="color:'+col10+';">'+spd(wind)+' '+spdU()+'</div><div style="font-size:9px;color:#22c55e;opacity:.75;margin-top:2px;">↑ alt ✓</div></div>';
          }
          return'<div class="fc-wind-stack">'+
            '<div class="fc-wind-row"><span class="fc-wind-alt">↑120</span><span class="fc-wind-val" style="color:'+col120+';">'+spd(w120)+'</span></div>'+
            '<div class="fc-wind-row"><span class="fc-wind-alt">↑80</span><span class="fc-wind-val" style="color:'+col80+';">'+spd(w80)+'</span></div>'+
            '<div class="fc-wind-row"><span class="fc-wind-alt">↑10</span><span class="fc-wind-val" style="color:'+col10+';">'+spd(wind)+'</span></div>'+
          '</div>';
        })()+
        '<div class="fc-dot '+rating.lvl+'"></div>'+
        '<div class="fc-chevron">▾</div>'+
      '</div>'+
      '<div class="fc-detail" id="fc-det-'+count+'">'+
        buildFcHourDetail(wind,gust,vis,ratingWmo,rawTempHr,w80,w120,precip,kpVal)+
      '</div>';
    count++;
  }
  document.getElementById('fc-body').innerHTML=
    '<div class="card"><h2 class="card-ttl">'+(isPro()?'Next 72 Hours':'Next 6 Hours')+' <span style="font-size:10px;font-weight:400;color:var(--muted);letter-spacing:0;text-transform:none;">— tap any hour for full conditions</span></h2>'+rows+
    '<div style="display:flex;gap:16px;margin-top:10px;font-size:12px;"><div style="display:flex;align-items:center;gap:6px;"><div class="fc-dot green" style="display:inline-block;"></div><span style="color:var(--muted);">✓ Good</span></div><div style="display:flex;align-items:center;gap:6px;"><div class="fc-dot amber" style="display:inline-block;"></div><span style="color:var(--muted);">⚠ Caution</span></div><div style="display:flex;align-items:center;gap:6px;"><div class="fc-dot red" style="display:inline-block;"></div><span style="color:var(--muted);">✕ Avoid</span></div></div>'+
    (!isPro()?'<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(245,158,11,.06);border-top:1px solid rgba(245,158,11,.15);border-radius:0 0 var(--radius-sm) var(--radius-sm);margin:10px -14px -14px;"><span style="font-size:12px;color:var(--muted);">72-hour forecast &amp; 7-day planner with Pro</span><button onclick="openProOverlay()" style="background:#f59e0b;border:none;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:700;color:#000;cursor:pointer;font-family:inherit;">Unlock</button></div>':'')+
    '</div>'+
    renderWeekPlanner(wxData.daily)+
    proAccountCard()+
    '<div style="height:14px;"></div>';
}
function updateWindHrRows(alt){
  var d=getDrone();
  document.querySelectorAll('.wind-hr-row').forEach(function(row){
    var w10=parseFloat(row.dataset.w10||0);
    var w80=parseFloat(row.dataset.w80||0);
    var w120=parseFloat(row.dataset.w120||0);
    var g=parseFloat(row.dataset.g||0);
    var windVal=alt==='80m'?w80:alt==='120m'?w120:w10;
    var r=(windVal>=d.windRed||g>=d.gustRed)?'red':(windVal>=d.windAmber||g>=d.gustAmber)?'amber':'green';
    var col=r==='red'?'var(--red)':r==='amber'?'var(--amber)':'var(--green)';
    var spdEl=row.querySelector('.whr-spd');
    if(spdEl){spdEl.textContent=spd(windVal)+' '+spdU()+' ('+alt+')';spdEl.style.color=col;}
    var dotEl=row.querySelector('.fc-dot');
    if(dotEl){dotEl.className='fc-dot '+r;}
    var gustEl=row.querySelector('.whr-gust');
    if(gustEl){
      var gustCol=g>=d.gustRed?'var(--red)':g>=d.gustAmber?'var(--amber)':'var(--muted)';
      gustEl.style.color=gustCol;
      gustEl.textContent='Gusts '+spd(g)+' '+spdU()+' · 10m only';
    }
  });
}
function switchWindAlt(alt){
  if(!window._wAlt)return;
  window._wAlt.sel=alt;
  ['10m','80m','120m'].forEach(function(a){
    var btn=document.getElementById('walt-'+a);
    if(!btn)return;
    var on=(a===alt);
    btn.style.background=on?'#38bdf8':'var(--bg3)';
    btn.style.color=on?'#fff':'var(--muted)';
    btn.style.borderColor=on?'#38bdf8':'var(--border)';
  });
  var ad=window._wAlt.data[alt];
  var dot=document.getElementById('wmap-dot');if(dot){dot.style.background=ad.hex;dot.style.boxShadow='0 0 6px '+ad.hex;}
  var sv=document.getElementById('wmap-spd');if(sv){sv.textContent=ad.label;sv.style.color=ad.hex;}
  var ts=document.getElementById('wtile-spd');if(ts&&window._wAlt.spdFn)ts.textContent=window._wAlt.spdFn(ad.spd);
  var tu=document.getElementById('wtile-unit');if(tu&&window._wAlt.spdUFn)tu.textContent=window._wAlt.spdUFn();
  var tk=document.getElementById('wtile-kt');if(tk)tk.textContent=(ad.spd*0.539957).toFixed(1);
  updateWindHrRows(alt);
  if(window._wAlt.relaunch)window._wAlt.relaunch();
}
function locateMeOnMap(){
  if(!navigator.geolocation){showToast('Location not supported');return;}
  showToast('Finding your location...');
  navigator.geolocation.getCurrentPosition(
    function(p){
      var newLat=p.coords.latitude,newLng=p.coords.longitude;
      var moved=!uLat||!uLng||Math.abs(newLat-uLat)>0.01||Math.abs(newLng-uLng)>0.01;
      uLat=newLat;uLng=newLng;
      if(windMap)windMap.setView([uLat,uLng],13);
      if(moved){revGeo();fetchAll();}
      else{showToast('Location confirmed');}
    },
    function(){showToast('Could not get location');},
    {timeout:12000,maximumAge:0}
  );
}
function initWindMap(){
  var windEl=document.getElementById('wind-display');
  if(!windEl)return;
  if(!wxData||!wxData.current){windEl.innerHTML='<div class="loading"><div class="spin"></div><p>Search for a location to see wind data.</p></div>';return;}
  var c=wxData.current;
  var rawWind=c.wind_speed_10m||0,rawGust=c.wind_gusts_10m||0;
  var raw80=c.wind_speed_80m||0,raw120=c.wind_speed_120m||0;
  var wind=spd(rawWind),gust=spd(rawGust);
  var deg=c.wind_direction_10m||0;
  var d=getDrone();
  function aHex(v,g){g=g||0;return(v>=d.windRed||g>=d.gustRed)?'#ef4444':(v>=d.windAmber||g>=d.gustAmber)?'#f59e0b':'#22c55e';}
  function aLbl(v,g){g=g||0;return(v>=d.windRed||g>=d.gustRed)?'✕':(v>=d.windAmber||g>=d.gustAmber)?'⚠':'✓';}
  var colHex=aHex(rawWind,rawGust);
  var col=(rawWind>=d.windRed||rawGust>=d.gustRed)?'var(--red)':(rawWind>=d.windAmber||rawGust>=d.gustAmber)?'var(--amber)':'var(--green)';
  var label=(rawWind>=d.windRed||rawGust>=d.gustRed)?'Too Strong':(rawWind>=d.windAmber||rawGust>=d.gustAmber)?'Caution':'Flyable';
  var dirStr=dirLabel(deg);
  var lat=uLat||51.5074,lng=uLng||(-0.1278);
  var col80=aHex(raw80),col120=aHex(raw120);
  function windWhy(){
    if(rawGust>=d.gustRed)return{lvl:'red',txt:'Gusts of '+gust+' '+spdU()+' exceed your drone\'s red limit ('+spd(d.gustRed)+' '+spdU()+').'};
    if(rawWind>=d.windRed)return{lvl:'red',txt:'Wind at 10m ('+wind+' '+spdU()+') exceeds your drone\'s red limit ('+spd(d.windRed)+' '+spdU()+').'};
    if(raw120>=d.windRed)return{lvl:'red',txt:'Wind at 120m ('+spd(raw120)+' '+spdU()+') exceeds your drone\'s red limit ('+spd(d.windRed)+' '+spdU()+').'};
    if(raw80>=d.windRed)return{lvl:'red',txt:'Wind at 80m ('+spd(raw80)+' '+spdU()+') exceeds your drone\'s red limit ('+spd(d.windRed)+' '+spdU()+').'};
    if(rawGust>=d.gustAmber)return{lvl:'amber',txt:'Gusts of '+gust+' '+spdU()+' exceed the caution threshold ('+spd(d.gustAmber)+' '+spdU()+').'};
    if(rawWind>=d.windAmber)return{lvl:'amber',txt:'Wind at 10m ('+wind+' '+spdU()+') exceeds the caution threshold ('+spd(d.windAmber)+' '+spdU()+').'};
    if(raw120>=d.windAmber)return{lvl:'amber',txt:'Wind at 120m ('+spd(raw120)+' '+spdU()+') exceeds the caution threshold ('+spd(d.windAmber)+' '+spdU()+').'};
    if(raw80>=d.windAmber)return{lvl:'amber',txt:'Wind at 80m ('+spd(raw80)+' '+spdU()+') exceeds the caution threshold ('+spd(d.windAmber)+' '+spdU()+').'};
    return null;
  }
  var why=windWhy();
  var maxAlt=Math.max(rawWind,raw80,raw120,d.windRed);
  function altBar(v){return Math.min(Math.round((v/maxAlt)*100),100)+'%';}
  var hours=wxData.hourly,now=new Date(),count=0;
  var nowLvl=flyRating(rawWind,rawGust,c.visibility||10000,c.weather_code||0,currentKp,c.temperature_2m!=null?c.temperature_2m:15,raw80,raw120).lvl;
  var nowCol=nowLvl==='red'?'var(--red)':nowLvl==='amber'?'var(--amber)':'var(--green)';
  var nowGustCol=rawGust>=d.gustRed?'var(--red)':rawGust>=d.gustAmber?'var(--amber)':'var(--muted)';
  var fcRows='<div class="wind-hr-row" data-w10="'+rawWind+'" data-w80="'+raw80+'" data-w120="'+raw120+'" data-g="'+rawGust+'" style="padding:10px 0;border-bottom:1px solid var(--border);border-left:2px solid #38bdf8;">'+
    '<div style="display:flex;align-items:center;gap:10px;padding-left:6px;">'+
      '<div class="whr-time" style="color:#38bdf8;">Now</div>'+
      '<div style="flex:1;">'+
        '<div class="whr-spd" style="font-size:13px;font-weight:600;color:'+nowCol+';">'+wind+' '+spdU()+'</div>'+
        '<div class="whr-gust" style="font-size:11px;color:'+nowGustCol+';">Gusts '+gust+' '+spdU()+' &middot; 10m only</div>'+
      '</div>'+
      '<div class="fc-dot '+nowLvl+'" style="flex-shrink:0;"></div>'+
    '</div>'+
  '</div>';
  var trendSum=0,trendCount=0;
  for(var i=0;i<hours.time.length;i++){
    if(locEntryMs(hours.time[i])>Date.now()&&trendCount<3){trendSum+=hours.wind_speed_10m[i]||0;trendCount++;}
  }
  var avgAhead=trendCount>0?trendSum/trendCount:rawWind;
  var trendDiff=avgAhead-rawWind;
  var trendTxt=trendDiff>3?'📈 Increasing':trendDiff<-3?'📉 Easing':'→ Steady';
  var trendCol=trendDiff>3?'#f59e0b':trendDiff<-3?'#22c55e':'rgba(241,245,249,.55)';
  var fcLastDate=null;
  for(var i=0;i<hours.time.length&&count<72;i++){
    var t=new Date(hours.time[i]);if(locEntryMs(hours.time[i])<Date.now())continue;
    var tDate=t.toDateString();
    if(tDate!==fcLastDate){
      fcRows+='<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;padding:'+(fcLastDate?'14px':'2px')+' 0 4px;">'+t.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})+'</div>';
      fcLastDate=tDate;
    }
    var hWind=hours.wind_speed_10m[i]||0;
    var hGust=hours.wind_gusts_10m?hours.wind_gusts_10m[i]||0:0;
    var hw=spd(hWind),hg=spd(hGust);
    var h80v=hours.wind_speed_80m?hours.wind_speed_80m[i]||0:0;
    var h120v=hours.wind_speed_120m?hours.wind_speed_120m[i]||0:0;
    var hPrecip=hours.precipitation_probability?Math.round(hours.precipitation_probability[i]||0):0;
    var hr=fcRating(hWind,hGust,hours.visibility?(hours.visibility[i]||10000):10000,hours.weather_code?(hours.weather_code[i]||0):0,hPrecip,hours.temperature_2m?Math.round(hours.temperature_2m[i]):15,0,0,0);
    var hcol=hr==='red'?'var(--red)':hr==='amber'?'var(--amber)':'var(--green)';
    var gustCol=hGust>=d.gustRed?'var(--red)':hGust>=d.gustAmber?'var(--amber)':'var(--muted)';
    fcRows+='<div class="wind-hr-row" data-w10="'+hWind+'" data-w80="'+h80v+'" data-w120="'+h120v+'" data-g="'+hGust+'" style="padding:10px 0;border-bottom:1px solid var(--border);">'+
      '<div style="display:flex;align-items:center;gap:10px;">'+
        '<div class="whr-time">'+pad(t.getHours())+':00</div>'+
        '<div style="flex:1;">'+
          '<div class="whr-spd" style="font-size:13px;font-weight:600;color:'+hcol+';">'+hw+' '+spdU()+'</div>'+
          '<div class="whr-gust" style="font-size:11px;color:'+gustCol+';">Gusts '+hg+' '+spdU()+' · 10m only</div>'+
        '</div>'+
        '<div class="fc-dot '+hr+'" style="flex-shrink:0;"></div>'+
      '</div>'+
    '</div>';
    count++;
  }
  windEl.innerHTML=
    '<div style="display:flex;gap:6px;padding:10px 12px 4px;align-items:center;">'+
      '<div style="font-size:11px;color:var(--muted);font-weight:600;margin-right:2px;">ALTITUDE</div>'+
      '<button id="walt-10m" onclick="switchWindAlt(\'10m\')" aria-label="Show wind at 10 metres" style="background:#38bdf8;color:#020617;border:1px solid #38bdf8;border-radius:7px;padding:6px 13px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">10m</button>'+
      '<button id="walt-80m" onclick="switchWindAlt(\'80m\')" aria-label="Show wind at 80 metres" style="background:var(--bg3);color:var(--muted);border:1px solid var(--border);border-radius:7px;padding:6px 13px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">80m</button>'+
      '<button id="walt-120m" onclick="switchWindAlt(\'120m\')" aria-label="Show wind at 120 metres" style="background:var(--bg3);color:var(--muted);border:1px solid var(--border);border-radius:7px;padding:6px 13px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">120m</button>'+
    '</div>'+
    '<div style="font-size:11px;color:var(--muted);padding:0 12px 8px;line-height:1.4;">10m = ground level &middot; 80m = mid altitude &middot; 120m = max legal height</div>'+
    '<div style="position:relative;">'+
      '<div id="wind-map-el" role="application" aria-label="Interactive wind map" style="height:300px;width:100%;"></div>'+
      '<div style="position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:1000;background:rgba(15,23,42,.88);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:8px 16px;display:flex;align-items:center;gap:10px;pointer-events:none;white-space:nowrap;">'+
        '<div id="wmap-dot" style="width:9px;height:9px;border-radius:50%;background:'+colHex+';box-shadow:0 0 6px '+colHex+';flex-shrink:0;"></div>'+
        '<div id="wmap-spd" style="font-size:15px;font-weight:700;color:'+colHex+';">'+wind+' '+spdU()+'</div>'+
        '<div style="font-size:12px;color:rgba(241,245,249,.55);">From the '+dirStr+' &middot; '+deg+'°</div>'+
        '<div style="font-size:12px;font-weight:600;color:'+trendCol+';">'+trendTxt+'</div>'+
      '</div>'+
      '<div style="position:absolute;bottom:24px;left:12px;z-index:1000;background:rgba(15,23,42,.92);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:8px 11px;pointer-events:none;min-width:148px;">'+
        '<div style="font-size:9px;font-weight:700;color:rgba(241,245,249,.35);letter-spacing:.5px;margin-bottom:6px;">WIND BY ALTITUDE</div>'+
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;"><div style="width:26px;font-size:10px;color:rgba(241,245,249,.4);text-align:right;flex-shrink:0;">10m</div><div style="flex:1;height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;"><div style="width:'+altBar(rawWind)+';height:100%;background:'+colHex+';border-radius:2px;"></div></div><div style="width:52px;font-size:11px;font-weight:600;color:'+colHex+';text-align:right;flex-shrink:0;">'+wind+' '+spdU()+'</div><div style="width:12px;font-size:10px;font-weight:700;color:'+colHex+';flex-shrink:0;">'+aLbl(rawWind,rawGust)+'</div></div>'+
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;"><div style="width:26px;font-size:10px;color:rgba(241,245,249,.4);text-align:right;flex-shrink:0;">80m</div><div style="flex:1;height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;"><div style="width:'+altBar(raw80)+';height:100%;background:'+col80+';border-radius:2px;"></div></div><div style="width:52px;font-size:11px;font-weight:600;color:'+col80+';text-align:right;flex-shrink:0;">'+spd(raw80)+' '+spdU()+'</div><div style="width:12px;font-size:10px;font-weight:700;color:'+col80+';flex-shrink:0;">'+aLbl(raw80)+'</div></div>'+
        '<div style="display:flex;align-items:center;gap:6px;"><div style="width:26px;font-size:10px;color:rgba(241,245,249,.4);text-align:right;flex-shrink:0;">120m</div><div style="flex:1;height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;"><div style="width:'+altBar(raw120)+';height:100%;background:'+col120+';border-radius:2px;"></div></div><div style="width:52px;font-size:11px;font-weight:600;color:'+col120+';text-align:right;flex-shrink:0;">'+spd(raw120)+' '+spdU()+'</div><div style="width:12px;font-size:10px;font-weight:700;color:'+col120+';flex-shrink:0;">'+aLbl(raw120)+'</div></div>'+
      '</div>'+
      '<button onclick="locateMeOnMap()" title="Centre map on my location" aria-label="Centre map on my location" style="position:absolute;bottom:90px;right:10px;z-index:1000;background:#334155;border:1px solid rgba(255,255,255,.2);border-radius:9px;width:34px;height:34px;cursor:pointer;color:#f1f5f9;display:flex;align-items:center;justify-content:center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg></button>'+
    '</div>'+
    (why?'<div style="display:flex;align-items:center;gap:7px;margin:10px 12px 0;padding:8px 11px;border-radius:8px;background:'+(why.lvl==='red'?'rgba(239,68,68,.12)':'rgba(245,158,11,.12)')+';border:1px solid '+(why.lvl==='red'?'rgba(239,68,68,.35)':'rgba(245,158,11,.35)')+';"><span style="font-size:13px;flex-shrink:0;">'+(why.lvl==='red'?'✕':'⚠')+'</span><span style="font-size:12px;color:'+(why.lvl==='red'?'#ef4444':'#f59e0b')+';line-height:1.4;">'+why.txt+'</span></div>':'')+
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:8px 12px;">'+
      '<div class="wx-tile"><div class="wx-lbl">Wind</div><div id="wtile-spd" class="wx-val" style="font-size:16px;">'+wind+'</div><div id="wtile-unit" class="wx-sub">'+spdU()+'</div></div>'+
      '<div class="wx-tile"><div class="wx-lbl">Gusts</div><div class="wx-val" style="font-size:16px;">'+gust+'</div><div class="wx-sub">'+spdU()+' · 10m only</div></div>'+
      '<div class="wx-tile"><div class="wx-lbl">Knots</div><div id="wtile-kt" class="wx-val" style="font-size:16px;">'+(rawWind*0.539957).toFixed(1)+'</div><div class="wx-sub">kt</div></div>'+
    '</div>'+
    '<div class="card"><h2 class="card-ttl">Hourly Wind Forecast</h2><div style="font-size:11px;color:var(--muted);margin-bottom:8px;line-height:1.5;">Rating icon shows wind conditions including gusts at the selected altitude. Use the altitude buttons above to switch.</div>'+fcRows+'</div>'+
    '<div style="height:14px;"></div>';
  if(windAnimFrame){cancelAnimationFrame(windAnimFrame);windAnimFrame=null;}
  if(windMap){windMap.remove();windMap=null;}
  windMap=L.map('wind-map-el',{center:[lat,lng],zoom:11,zoomControl:false,attributionControl:true});
  
  L.maplibreGL({
    style: 'https://tiles.openfreemap.org/styles/liberty',
    attribution: '© <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer" style="color:#94a3b8;">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" style="color:#94a3b8;">OSM</a>',
  }).addTo(windMap);

  L.control.zoom({position:'bottomright'}).addTo(windMap);
  L.circleMarker([lat,lng],{radius:6,color:'#38bdf8',fillColor:'#38bdf8',fillOpacity:1,weight:2,opacity:0.9,interactive:false}).addTo(windMap);
  window._wAlt={
    sel:'10m',
    data:{
      '10m':{spd:rawWind,hex:colHex,label:wind+' '+spdU()},
      '80m':{spd:raw80,hex:col80,label:spd(raw80)+' '+spdU()},
      '120m':{spd:raw120,hex:col120,label:spd(raw120)+' '+spdU()}
    },
    spdFn:spd,
    spdUFn:spdU,
    relaunch:null
  };
  setTimeout(function(){
    if(!windMap)return;
    windMap.invalidateSize();
    var mapEl=document.getElementById('wind-map-el');
    if(!mapEl)return;
    var windCanvas=document.createElement('canvas');
    windCanvas.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:400;';
    mapEl.appendChild(windCanvas);
    var W=mapEl.offsetWidth,H=mapEl.offsetHeight;
    windCanvas.width=W;windCanvas.height=H;
    var wctx=windCanvas.getContext('2d');
    var moveRad=((deg+180)%360)*Math.PI/180;
    var pdx=Math.sin(moveRad),pdy=-Math.cos(moveRad);
    var NPART=120;
    var parts=[];
    function getAlt(){return window._wAlt?window._wAlt.data[window._wAlt.sel]:window._wAlt.data['10m'];}
    function mkPart(born){
      var s=Math.max(1.2,Math.min(getAlt().spd,80)/80*4)+0.6;
      return{x:Math.random()*W,y:Math.random()*H,age:born?0:Math.random()*90,maxAge:80+Math.random()*60,speed:s*(0.55+Math.random()*0.9),sz:1.1+Math.random()*1.5,trail:[]};
    }
    function launch(){
      if(windAnimFrame){cancelAnimationFrame(windAnimFrame);windAnimFrame=null;}
      if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){
        var alt=getAlt();
        wctx.clearRect(0,0,W,H);
        wctx.font='bold 16px sans-serif';
        wctx.fillStyle=alt.hex;
        wctx.textAlign='center';
        wctx.textBaseline='middle';
        wctx.fillText(alt.label+' — '+alt.spd.toFixed(0)+' '+spdU(),W/2,H/2);
        wctx.font='13px sans-serif';
        wctx.fillStyle='rgba(241,245,249,0.4)';
        wctx.fillText('Wind animation paused (reduced motion)',W/2,H/2+28);
        return;
      }
      parts=[];
      for(var pi=0;pi<NPART;pi++)parts.push(mkPart(false));
      function wanimate(){
        var alt=getAlt();
        var hex=alt.hex;
        var cr=parseInt(hex.slice(1,3),16),cg=parseInt(hex.slice(3,5),16),cb=parseInt(hex.slice(5,7),16);
        wctx.clearRect(0,0,W,H);
        parts.forEach(function(p){
          p.trail.push({x:p.x,y:p.y});
          if(p.trail.length>16)p.trail.shift();
          p.x+=pdx*p.speed;p.y+=pdy*p.speed;p.age++;
          if(p.age>p.maxAge||p.x<-40||p.x>W+40||p.y<-40||p.y>H+40){Object.assign(p,mkPart(true));return;}
          var a=Math.min(p.age/18,1)*(1-p.age/p.maxAge)*0.9;
          if(p.trail.length>1){
            for(var t=1;t<p.trail.length;t++){
              var ta=a*(t/p.trail.length)*0.65;
              wctx.beginPath();
              wctx.moveTo(p.trail[t-1].x,p.trail[t-1].y);
              wctx.lineTo(p.trail[t].x,p.trail[t].y);
              wctx.strokeStyle='rgba('+cr+','+cg+','+cb+','+ta.toFixed(3)+')';
              wctx.lineWidth=p.sz*(t/p.trail.length);
              wctx.stroke();
            }
          }
          wctx.beginPath();
          wctx.arc(p.x,p.y,p.sz,0,Math.PI*2);
          wctx.fillStyle='rgba('+cr+','+cg+','+cb+','+a.toFixed(3)+')';
          wctx.fill();
        });
        windAnimFrame=requestAnimationFrame(wanimate);
      }
      wanimate();
    }
    window._wAlt.relaunch=launch;
    launch();
    var visListener=function(){
      if(document.hidden){
        if(windAnimFrame){cancelAnimationFrame(windAnimFrame);windAnimFrame=null;}
      } else if(!windAnimFrame && window._wAlt && window._wAlt.relaunch){
        var radarTab=document.getElementById('tab-radar');
        if(radarTab && radarTab.classList.contains('on'))window._wAlt.relaunch();
      }
    };
    if(window._windVisHandler)document.removeEventListener('visibilitychange',window._windVisHandler);
    window._windVisHandler=visListener;
    document.addEventListener('visibilitychange',visListener);
  },150);
}
function calcSunTimes(lat,lng,date){
  var rad=Math.PI/180,deg=180/Math.PI,start=new Date(date.getFullYear(),0,0),doy=Math.floor((date-start)/86400000);
  var B=(360/365)*(doy-81)*rad,EoT=9.87*Math.sin(2*B)-7.53*Math.cos(B)-1.5*Math.sin(B),decl=23.45*Math.sin(B)*rad,tz=-date.getTimezoneOffset()/60;
  function ha(elev){var c=(Math.sin(elev*rad)-Math.sin(lat*rad)*Math.sin(decl))/(Math.cos(lat*rad)*Math.cos(decl));return(c<-1||c>1)?null:Math.acos(c)*deg;}
  function mins(angle,rising){if(angle===null)return null;return 720-4*(lng+(rising?angle:-angle))+EoT+tz*60;}
  function toDate(m){if(m===null)return null;var d=new Date(date);d.setHours(0,0,0,0);d.setMinutes(Math.round(m));return d;}
  var hSun=ha(-0.833),hCivil=ha(-6),hNaut=ha(-12),hGoldS=ha(-4),hGoldE=ha(6);
  return{nautDawn:toDate(mins(hNaut,true)),blueDawnE:toDate(mins(hCivil,true)),goldMornS:toDate(mins(hGoldS,true)),goldMornE:toDate(mins(hGoldE,true)),sunrise:toDate(mins(hSun,true)),sunset:toDate(mins(hSun,false)),goldEveS:toDate(mins(hGoldE,false)),goldEveE:toDate(mins(hGoldS,false)),blueEveS:toDate(mins(hCivil,false)),nautDusk:toDate(mins(hNaut,false)),solarNoon:toDate(720-4*lng+EoT+tz*60)};
}
function sunElevation(lat,lng,date){
  var rad=Math.PI/180,deg=180/Math.PI;
  var start=new Date(date.getFullYear(),0,0),doy=Math.floor((date-start)/86400000);
  var B=(360/365)*(doy-81)*rad,EoT=9.87*Math.sin(2*B)-7.53*Math.cos(B)-1.5*Math.sin(B);
  var decl=23.45*Math.sin(B)*rad,tz=-date.getTimezoneOffset()/60;
  var mins=date.getHours()*60+date.getMinutes()+date.getSeconds()/60;
  var solarNoon=720-4*lng+EoT+tz*60;
  var hourAngle=(mins-solarNoon)*0.25;
  var sinEl=Math.sin(lat*rad)*Math.sin(decl)+Math.cos(lat*rad)*Math.cos(decl)*Math.cos(hourAngle*rad);
  return Math.asin(sinEl)*deg;
}
function sunAzimuth(lat,lng,date){
  var rad=Math.PI/180,deg=180/Math.PI;
  var start=new Date(date.getFullYear(),0,0),doy=Math.floor((date-start)/86400000);
  var B=(360/365)*(doy-81)*rad,EoT=9.87*Math.sin(2*B)-7.53*Math.cos(B)-1.5*Math.sin(B);
  var decl=23.45*Math.sin(B)*rad,tz=-date.getTimezoneOffset()/60,latR=lat*rad;
  var mins=date.getHours()*60+date.getMinutes()+date.getSeconds()/60;
  var solarNoon=720-4*lng+EoT+tz*60,hourAngle=(mins-solarNoon)*0.25*rad;
  var elR=Math.asin(Math.sin(latR)*Math.sin(decl)+Math.cos(latR)*Math.cos(decl)*Math.cos(hourAngle));
  var cosAz=(Math.sin(decl)-Math.sin(elR)*Math.sin(latR))/(Math.cos(elR)*Math.cos(latR));
  cosAz=Math.max(-1,Math.min(1,cosAz));
  var az=Math.acos(cosAz)*deg;
  return hourAngle>0?360-az:az;
}
function nearestHourlyCloud(hours,target){
  if(!hours||!hours.time||!target)return null;
  var bestIdx=-1,bestDiff=Infinity;
  for(var i=0;i<hours.time.length;i++){
    var diff=Math.abs(new Date(hours.time[i])-target);
    if(diff<bestDiff){bestDiff=diff;bestIdx=i;}
  }
  if(bestIdx<0||bestDiff>5400000)return null;
  return{low:hours.cloud_cover_low?hours.cloud_cover_low[bestIdx]||0:0,mid:hours.cloud_cover_mid?hours.cloud_cover_mid[bestIdx]||0:0,high:hours.cloud_cover_high?hours.cloud_cover_high[bestIdx]||0:0};
}
function sunEventQuality(low,mid,high){
  var colorCloud=Math.max(mid,high);
  var colorScore=colorCloud<=40?65+(colorCloud/40)*35:100-((colorCloud-40)/60)*80;
  colorScore=Math.max(0,Math.min(100,colorScore));
  var horizonFactor=1-Math.pow(Math.min(Math.max(low,0),100)/100,1.3);
  return Math.round(Math.max(0,Math.min(100,colorScore*horizonFactor)));
}
function initGoldenMap(lat,lng,today){
  var mapEl=document.getElementById('gh-map-el');
  if(!mapEl||typeof L==='undefined')return;
  if(ghMap){ghMap.remove();ghMap=null;}
  var t=calcSunTimes(lat,lng,today);
  var sunriseAz=t.sunrise?sunAzimuth(lat,lng,t.sunrise):null;
  var sunsetAz=t.sunset?sunAzimuth(lat,lng,t.sunset):null;
  var legendEl=document.getElementById('gh-map-legend');
  if(legendEl){
    legendEl.innerHTML=
      (sunriseAz!=null?'<span><span style="display:inline-block;width:10px;height:3px;background:#fbbf24;margin-right:4px;vertical-align:middle;"></span>Sunrise '+Math.round(sunriseAz)+'°</span>':'')+
      (sunsetAz!=null?'<span><span style="display:inline-block;width:10px;height:3px;background:#f97316;margin-right:4px;vertical-align:middle;"></span>Sunset '+Math.round(sunsetAz)+'°</span>':'')+
      '<span><span style="display:inline-block;width:10px;height:3px;background:#ef4444;margin-right:4px;vertical-align:middle;"></span>Selected time</span>';
  }
  var dayBase=new Date(today);dayBase.setHours(0,0,0,0);
  var nowMinutes=today.getHours()*60+today.getMinutes();
  function timeAt(m){var d=new Date(dayBase);d.setMinutes(m);return d;}
  ghMap=L.map('gh-map-el',{center:[lat,lng],zoom:13,zoomControl:false,attributionControl:true});
  L.maplibreGL({
    style:'https://tiles.openfreemap.org/styles/liberty',
    attribution:'© <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer" style="color:#94a3b8;">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" style="color:#94a3b8;">OSM</a>',
  }).addTo(ghMap);
  L.control.zoom({position:'bottomright'}).addTo(ghMap);
  L.circleMarker([lat,lng],{radius:6,color:'#38bdf8',fillColor:'#38bdf8',fillOpacity:1,weight:2,opacity:0.9,interactive:false}).addTo(ghMap);
  setTimeout(function(){
    if(!ghMap)return;
    ghMap.invalidateSize();
    var W=mapEl.offsetWidth,H=mapEl.offsetHeight;
    if(!W||!H)return;
    var canvas=document.createElement('canvas');
    canvas.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:400;';
    mapEl.appendChild(canvas);
    canvas.width=W;canvas.height=H;
    var ctx=canvas.getContext('2d'),rayLen=Math.sqrt(W*W+H*H),selectedMinutes=nowMinutes;
    function ray(cx,cy,az,color){
      if(az==null)return;
      var a=az*Math.PI/180;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+rayLen*Math.sin(a),cy-rayLen*Math.cos(a));
      ctx.strokeStyle=color;ctx.lineWidth=3;ctx.stroke();
    }
    function draw(){
      var pt=ghMap.latLngToContainerPoint([lat,lng]),cx=pt.x,cy=pt.y;
      ctx.clearRect(0,0,W,H);
      ray(cx,cy,sunriseAz,'rgba(251,191,36,.85)');
      ray(cx,cy,sunsetAz,'rgba(249,115,22,.85)');
      var selD=timeAt(selectedMinutes),selEl=sunElevation(lat,lng,selD),selAz=sunAzimuth(lat,lng,selD);
      if(selEl>-6)ray(cx,cy,selAz,'rgba(239,68,68,.85)');
      var roEl=document.getElementById('gh-map-readout');
      if(roEl){
        roEl.innerHTML=
          '<div style="background:rgba(15,23,42,.94);border-radius:8px;padding:6px 9px;margin-bottom:6px;"><div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.4px;">Altitude</div><div style="font-size:14px;font-weight:700;color:#f1f5f9;">'+selEl.toFixed(1)+'°</div></div>'+
          '<div style="background:rgba(15,23,42,.94);border-radius:8px;padding:6px 9px;"><div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.4px;">Azimuth</div><div style="font-size:14px;font-weight:700;color:#f1f5f9;">'+selAz.toFixed(1)+'°</div></div>';
      }
    }
    draw();
    ghMap.on('move zoom',draw);
    var sliderEl=document.getElementById('gh-time-slider'),timeLabelEl=document.getElementById('gh-time-label');
    if(sliderEl){
      sliderEl.value=selectedMinutes;
      function updateLabel(){if(timeLabelEl)timeLabelEl.textContent=fmtTime(timeAt(selectedMinutes))+(Math.abs(selectedMinutes-nowMinutes)<5?' (now)':'');}
      updateLabel();
      sliderEl.oninput=function(){selectedMinutes=parseInt(sliderEl.value,10);updateLabel();draw();};
    }
  },150);
}
function photoScore(wind,gust,vis,cloud,wmo,lat,lng){
  var now=new Date(),el=(lat&&lng)?sunElevation(lat,lng,now):-90;
  // Sun elevation score (0-25): golden/blue hour = best, harsh midday or dark = worst
  var sunPts;
  if(el<-6)sunPts=0;
  else if(el<0)sunPts=20; // blue hour
  else if(el<6)sunPts=25; // golden hour
  else if(el<20)sunPts=18; // low sun — still directional and warm
  else if(el<45)sunPts=10;
  else sunPts=5; // harsh overhead light
  // Cloud diffusion score (0-25): soft overcast > partly cloudy > clear > heavy overcast
  var cloudPts;
  if(cloud<20)cloudPts=14;       // clear — can be harsh
  else if(cloud<50)cloudPts=20;  // partly cloudy — natural fill light
  else if(cloud<80)cloudPts=25;  // overcast — beautiful diffuse light
  else cloudPts=14;              // heavy overcast — too dark/flat
  // Visibility / haze score (0-25)
  var visPts;
  if(vis>=20000)visPts=25;
  else if(vis>=10000)visPts=20;
  else if(vis>=5000)visPts=12;
  else if(vis>=2000)visPts=5;
  else visPts=0;
  // Wind stability score (0-25): smooth air = sharp images
  var gustRatio=wind>0?(gust/wind):1;
  var windPts;
  if(wind<10&&gustRatio<1.3)windPts=25;
  else if(wind<15&&gustRatio<1.5)windPts=18;
  else if(wind<25)windPts=10;
  else windPts=3;
  // Rain/snow kills shots entirely
  var rainWmo=[51,53,55,61,63,65,71,73,75,80,81,82,85,86,95,96,99];
  if(rainWmo.indexOf(wmo)!==-1){visPts=Math.min(visPts,5);cloudPts=Math.min(cloudPts,8);}
  var total=sunPts+cloudPts+visPts+windPts;
  var grade,label,col;
  if(sunPts===0){grade='F';label='Night — low ambient light';col='#ef4444';}
  else if(total>=85){grade='A+';label='Exceptional light';col='#22c55e';}
  else if(total>=72){grade='A';label='Excellent light';col='#22c55e';}
  else if(total>=60){grade='B';label='Good light';col='#84cc16';}
  else if(total>=46){grade='C';label='Fair light';col='#f59e0b';}
  else if(total>=30){grade='D';label='Poor light';col='#f97316';}
  else{grade='F';label='Not ideal';col='#ef4444';}
  var sunLabel=el<-6?'Dark':el<0?'Blue hour':el<6?'Golden hour':el<20?'Low sun':el<45?'Mid sun':'High sun';
  var cloudLabel=cloud<20?'Clear sky':cloud<50?'Partly cloudy':cloud<80?'Overcast':'Heavy overcast';
  var visLabel=vis>=10000?'Crystal clear':vis>=5000?'Good':'Hazy';
  var windLabel=windPts>=25?'Smooth':windPts>=18?'Light':windPts>=10?'Gusty':'Turbulent';
  return{grade:grade,label:label,col:col,total:total,sunPts:sunPts,cloudPts:cloudPts,visPts:visPts,windPts:windPts,sunLabel:sunLabel,cloudLabel:cloudLabel,visLabel:visLabel,windLabel:windLabel};
}
function renderPhotoScoreCard(){
  if(!isPro()||!wxData||!wxData.current)return'';
  var c=wxData.current,wind=c.wind_speed_10m||0,gust=c.wind_gusts_10m||0;
  var vis=c.visibility||10000,cloud=c.cloud_cover||0,wmo=c.weather_code||0;
  var ps=photoScore(wind,gust,vis,cloud,wmo,uLat,uLng);
  var ndEl=(uLat&&uLng)?sunElevation(uLat,uLng,new Date()):0;
  var rec=cameraRec(cloud,ndEl);
  var nd=rec.nd;
  function factorRow(icon,label,sub,pts){
    var pct=Math.round(pts/25*100);
    var fc=pts>=20?'#22c55e':pts>=14?'#84cc16':pts>=8?'#f59e0b':'#ef4444';
    return'<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04);">'+
      '<span style="font-size:15px;width:20px;text-align:center;">'+icon+'</span>'+
      '<div style="flex:1;min-width:0;">'+
        '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">'+
          '<span style="font-size:12px;font-weight:600;color:var(--text);">'+label+'</span>'+
          '<span style="font-size:11px;color:var(--muted);">'+sub+'</span>'+
        '</div>'+
        '<div style="height:4px;border-radius:2px;background:rgba(255,255,255,.08);overflow:hidden;">'+
          '<div style="height:100%;width:'+pct+'%;background:'+fc+';border-radius:2px;transition:width .4s;"></div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }
  var barPct=Math.round(ps.total/100*100);
  var infoSvg='<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><rect x="7.25" y="6.5" width="1.5" height="5" rx=".75" fill="currentColor"/><rect x="7.25" y="4" width="1.5" height="1.5" rx=".75" fill="currentColor"/></svg>';
  return'<div class="card" style="border-color:rgba(168,85,247,.25);">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">'+
      '<div style="display:flex;align-items:center;gap:6px;">'+
        '<h2 class="card-ttl" style="margin-bottom:0;">Photo Conditions</h2>'+
        '<button class="wx-info-btn" id="photo-info-btn" onclick="(function(b){var p=document.getElementById(\'photo-info-panel\');var open=p.style.display===\'block\';p.style.display=open?\'none\':\'block\';b.classList.toggle(\'active\',!open);})(this)" aria-label="About Photo Conditions">'+infoSvg+'</button>'+
      '</div>'+
      '<span style="font-size:9px;font-weight:700;color:#f59e0b;background:rgba(245,158,11,.12);border-radius:3px;padding:1px 5px;">PRO</span>'+
    '</div>'+
    '<div id="photo-info-panel" style="display:none;font-size:11px;color:var(--muted);line-height:1.7;margin-bottom:12px;padding:10px 12px;background:rgba(255,255,255,.04);border-radius:var(--radius-sm);border:1px solid var(--border);">'+
      'Scores current conditions for aerial photography out of 100, combining four factors (each worth up to 25 pts):<br><br>'+
      '<strong style="color:var(--text);">☀️ Light quality</strong> — Based on sun elevation angle. Golden hour (sun 0–6° above horizon) scores highest for warm, directional light. Blue hour (−6° to 0°) is also excellent for moody shots. Harsh midday sun scores lowest.<br><br>'+
      '<strong style="color:var(--text);">☁️ Cloud diffusion</strong> — Overcast skies (50–80% cloud) produce beautiful, even light with no harsh shadows. Partly cloudy adds natural fill. Clear skies can mean harsh contrast; heavy overcast goes flat and dark.<br><br>'+
      '<strong style="color:var(--text);">👁 Clarity</strong> — Visibility and atmospheric haze. Crystal-clear air gives sharp horizon shots and vibrant colours. Haze and mist soften distant detail and reduce contrast.<br><br>'+
      '<strong style="color:var(--text);">💨 Air stability</strong> — Low wind and a small gust-to-wind ratio means smooth, steady footage and sharper stills. Turbulent, gusty air causes micro-jitter even within safe flying limits.<br><br>'+
      '<strong style="color:var(--text);">🎞️ ND Filter</strong> — Estimated filter strength to keep your shutter speed close to double your frame rate (the "180° rule") for natural-looking motion blur, based on how bright the light currently is. A creative guide, not a flight-safety reading.<br><br>'+
      '<strong style="color:var(--text);">📷 Recommended settings</strong> — Aperture, ISO, shutter and white balance starting points for your selected drone\'s camera, tuned to the current light. '+(rec.cam.isEstimate?'Your model\'s exact camera spec isn\'t published, so this uses a same-sensor-class estimate.':'Based on your drone\'s published camera spec ('+rec.cam.sensor+' sensor, f/'+rec.cam.apertureMin+(rec.cam.apertureFixed?' fixed':'–f/'+rec.cam.apertureMax+' variable')+').')+' Always a starting point — adjust to taste.'+
    '</div>'+
    '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">'+
      '<div style="width:56px;height:56px;border-radius:14px;background:rgba(168,85,247,.12);border:2px solid '+ps.col+';display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+
        '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="'+ps.col+'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>'+
      '</div>'+
      '<div style="flex:1;min-width:0;">'+
        '<div style="font-size:15px;font-weight:700;color:'+ps.col+';margin-bottom:4px;">'+ps.label+'</div>'+
        '<div style="height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;">'+
          '<div style="height:100%;width:'+barPct+'%;background:'+ps.col+';border-radius:3px;transition:width .4s;"></div>'+
        '</div>'+
        '<div style="font-size:11px;color:var(--muted);margin-top:4px;">'+ps.total+'/100</div>'+
      '</div>'+
    '</div>'+
    factorRow('☀️','Light quality',ps.sunLabel,ps.sunPts)+
    factorRow('☁️','Cloud diffusion',ps.cloudLabel,ps.cloudPts)+
    factorRow('👁','Clarity',ps.visLabel,ps.visPts)+
    factorRow('💨','Air stability',ps.windLabel,ps.windPts)+
    (function(){var ndCol=nd.col==='green'?'#22c55e':nd.col==='amber'?'#f59e0b':'#a855f7';return'<div style="margin-top:10px;padding:10px 12px;background:rgba(168,85,247,.08);border:1px solid rgba(168,85,247,.25);border-radius:var(--radius-sm);display:flex;align-items:center;gap:10px;">'+
      '<span style="font-size:18px;flex-shrink:0;">🎞️</span>'+
      '<div style="flex:1;min-width:0;">'+
        '<div style="font-size:12px;font-weight:700;color:'+ndCol+';">ND Filter: '+nd.lvl+'</div>'+
        '<div style="font-size:11px;color:var(--muted);">'+nd.sub+'</div>'+
      '</div>'+
    '</div>';})()+
    (function(){
      function row(label,val,note){
        return'<div style="display:flex;justify-content:space-between;align-items:baseline;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);gap:10px;">'+
          '<span style="font-size:11px;color:var(--muted);flex-shrink:0;">'+label+'</span>'+
          '<span style="font-size:12px;font-weight:700;color:var(--text);text-align:right;">'+val+(note?'<div style="font-size:10px;font-weight:400;color:var(--muted);margin-top:1px;">'+note+'</div>':'')+'</span>'+
        '</div>';
      }
      return'<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);">'+
        '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Recommended settings — '+esc(getDrone().name)+'</div>'+
        row('Aperture',rec.aperture,rec.apertureNote)+
        row('ISO',rec.iso,rec.isoNote)+
        row('Shutter (video)',rec.shutterVideo,'')+
        row('Shutter (photo)',rec.shutterPhoto,'')+
        row('White balance',rec.wb,'')+
      '</div>';
    })()+
  '</div>';
}
function countdown(d){if(!d)return'';var diff=d-new Date();if(diff<0)return'Passed';var h=Math.floor(diff/3600000),m=Math.floor((diff%3600000)/60000);return'in '+(h>0?h+'h ':'')+m+'m';}
function isNow(s,e){var now=new Date();return s&&e&&now>=s&&now<=e;}
function getSunsetCountdown(){
  if(!uLat||!uLng)return null;
  try{
    var now=new Date(),times=calcSunTimes(uLat,uLng,now);
    if(times.sunset&&times.sunset>now){
      var diff=times.sunset-now,h=Math.floor(diff/3600000),m=Math.floor((diff%3600000)/60000);
      return{event:'Sunset',time:fmtTime(times.sunset),countdown:(h>0?h+'h ':'')+m+'m',color:'#f97316'};
    }
    var tomorrow=new Date(now);tomorrow.setDate(tomorrow.getDate()+1);
    var tm=calcSunTimes(uLat,uLng,tomorrow);
    if(tm.sunrise){
      var diff2=tm.sunrise-now,h2=Math.floor(diff2/3600000),m2=Math.floor((diff2%3600000)/60000);
      return{event:'Sunrise',time:fmtTime(tm.sunrise),countdown:(h2>0?h2+'h ':'')+m2+'m',color:'#f59e0b'};
    }
  }catch(e){}
  return null;
}
function renderGolden(){
  if(!uLat||!uLng){document.getElementById('gh-body').innerHTML='<div class="loading"><div class="spin"></div><p>Search for a location to see golden hour times.</p></div>';return;}
  try{
  var today=new Date(),tomorrow=new Date(today);tomorrow.setDate(today.getDate()+1);
  var t=calcSunTimes(uLat,uLng,today),tm=calcSunTimes(uLat,uLng,tomorrow),loc=document.getElementById('loc-name').textContent;
  function slot(emoji,label,col,start,end,desc){
    var active=isNow(start,end),cd=(!active&&start)?countdown(start):'';
    var badge=active?'<span class="gh-badge" style="background:'+col+';color:#fff;">LIVE NOW</span>':'';
    var cds=(cd&&cd!=='Passed')?'<span class="gh-countdown">'+cd+'</span>':'';
    var sStr=start?fmtTime(start):'--:--',eStr=end?fmtTime(end):'--:--';
    return'<div class="gh-slot" style="border-left-color:'+col+';"><div class="gh-slot-header"><div class="gh-slot-name">'+emoji+' '+label+badge+cds+'</div><div class="gh-slot-time" style="color:'+col+';">'+(start&&end&&Math.abs(end-start)<120000?sStr:sStr+' – '+eStr)+'</div></div><div class="gh-slot-desc">'+desc+'</div></div>';
  }
  function tmTile(label,col,d){return'<div class="gh-tmrw-tile"><div class="gh-tmrw-lbl">'+label+'</div><div class="gh-tmrw-val" style="color:'+col+';">'+(d?fmtTime(d):'--:--')+'</div></div>';}
  function qualityMeta(pct){
    if(pct==null)return{label:'No data',col:'#64748b'};
    if(pct>=75)return{label:'Great',col:'#22c55e'};
    if(pct>=55)return{label:'Good',col:'#84cc16'};
    if(pct>=35)return{label:'Fair',col:'#f59e0b'};
    return{label:'Poor',col:'#ef4444'};
  }
  function qualityRow(emoji,label,pct,isPast){
    var m=qualityMeta(pct);
    var doneTag=isPast?'<span style="font-size:10px;color:var(--muted);font-weight:600;margin-left:6px;">✓ Done for today</span>':'';
    return'<div style="margin-bottom:10px;'+(isPast?'opacity:.45;':'')+'"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;"><div style="font-size:13px;font-weight:600;color:var(--text);">'+emoji+' '+label+doneTag+'</div><div style="font-size:13px;font-weight:700;color:'+m.col+';">'+(pct!=null?pct+'% · '+m.label:'No data')+'</div></div><div style="height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;"><div style="height:100%;width:'+(pct||0)+'%;background:'+m.col+';border-radius:3px;"></div></div></div>';
  }
  var hourlyData=wxData&&wxData.hourly?wxData.hourly:null;
  function qualityFor(d){var c=nearestHourlyCloud(hourlyData,d);return c?sunEventQuality(c.low,c.mid,c.high):null;}
  var sunriseQ=qualityFor(t.sunrise),sunsetQ=qualityFor(t.sunset),sunriseQTm=qualityFor(tm.sunrise),sunsetQTm=qualityFor(tm.sunset);
  var sunrisePast=!!(t.sunrise&&t.sunrise<today),sunsetPast=!!(t.sunset&&t.sunset<today);
  document.getElementById('gh-body').innerHTML=
    '<div class="card"><h2 class="card-ttl">Today — '+today.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})+'</h2><div style="font-size:12px;color:var(--muted);margin-bottom:12px;">📍 '+esc(loc)+'</div>'+
    slot('🌑','Blue Hour — Dawn','#818cf8',t.nautDawn,t.blueDawnE,'Deep blue pre-dawn sky. Great for moody shots before sunrise.')+
    slot('🌅','Golden Hour — Morning','#f59e0b',t.goldMornS,t.goldMornE,'Warm, soft light just after sunrise. Long shadows and golden tones.')+
    slot('☀️','Sunrise','#f97316',t.sunrise,t.sunrise,'Sun crosses the horizon. Be airborne 10 minutes before.')+
    slot('🌇','Sunset','#f97316',t.sunset,t.sunset,'Sun crosses the horizon. Most popular time to fly.')+
    slot('🌆','Golden Hour — Evening','#f59e0b',t.goldEveS,t.goldEveE,'The classic golden hour. Warm directional light before sunset.')+
    slot('🌃','Blue Hour — Dusk','#818cf8',t.blueEveS,t.nautDusk,'Deep blue sky after sunset. City lights begin to appear.')+
    '</div>'+
    '<div class="card"><h2 class="card-ttl">Sunrise &amp; Sunset Quality</h2><div style="font-size:11px;color:var(--muted);margin-bottom:12px;">Likelihood of vivid colour, based on cloud cover near the horizon.</div>'+
    qualityRow('🌅','Sunrise',sunriseQ,sunrisePast)+qualityRow('🌇','Sunset',sunsetQ,sunsetPast)+
    '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin:14px 0 8px;">Tomorrow</div>'+
    qualityRow('🌅','Sunrise',sunriseQTm)+qualityRow('🌇','Sunset',sunsetQTm)+
    '</div>'+
    '<div class="card"><h2 class="card-ttl">Sun Path</h2><div style="position:relative;"><div id="gh-map-el" role="application" aria-label="Map showing the sun\'s direction throughout the day" style="height:240px;width:100%;border-radius:var(--radius-sm);overflow:hidden;"></div><div style="position:absolute;bottom:10px;left:10px;z-index:1000;pointer-events:none;" id="gh-map-readout"></div><div style="position:absolute;top:10px;right:10px;z-index:1000;background:rgba(15,23,42,.7);border-radius:6px;padding:3px 7px;font-size:10px;font-weight:600;color:#e2e8f0;pointer-events:none;">N&#8593;</div></div>'+
    '<div style="margin-top:12px;"><input type="range" id="gh-time-slider" min="0" max="1439" step="5" value="720" style="width:100%;accent-color:#ef4444;display:block;" aria-label="Time of day"><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:2px;"><span>00:00</span><span id="gh-time-label" style="font-size:12px;font-weight:700;color:var(--text);">--:--</span><span>23:55</span></div></div>'+
    '<div id="gh-map-legend" style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:var(--muted);"></div></div>'+
    renderPhotoScoreCard()+
    '<div class="card"><h2 class="card-ttl">Tomorrow at a Glance</h2><div class="gh-tmrw">'+
    tmTile('🌑 Blue Dawn','#818cf8',tm.nautDawn)+tmTile('🌅 Golden Morning','#f59e0b',tm.goldMornS)+
    tmTile('☀️ Sunrise','#f97316',tm.sunrise)+tmTile('🌇 Sunset','#f97316',tm.sunset)+
    tmTile('🌆 Golden Evening','#f59e0b',tm.goldEveS)+tmTile('🌃 Blue Dusk','#818cf8',tm.blueEveS)+
    '</div></div><div style="height:14px;"></div>'+proAccountCard();
  initGoldenMap(uLat,uLng,today);
  }catch(e){
    document.getElementById('gh-body').innerHTML='<div class="err">Could not calculate golden hour for this location.<br><br><button onclick="renderGolden()" style="background:var(--accent);border:none;border-radius:var(--radius-sm);padding:10px 20px;color:#020617;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">↻ Try Again</button></div>';
  }
}
function goTab(id,btn){
  if(ghRefreshTimer){clearInterval(ghRefreshTimer);ghRefreshTimer=null;}
  if(id!=='radar' && windAnimFrame){cancelAnimationFrame(windAnimFrame);windAnimFrame=null;}
  var tabs=document.querySelectorAll('.tab');for(var i=0;i<tabs.length;i++)tabs[i].classList.remove('on');
  var nbs=document.querySelectorAll('.nb');for(var i=0;i<nbs.length;i++)nbs[i].classList.remove('on');
  var tabEl=document.getElementById('tab-'+id);if(tabEl)tabEl.classList.add('on');
  if(btn){btn.classList.add('on');btn.setAttribute('aria-selected','true');}
  document.querySelectorAll('.nb').forEach(function(b){if(b!==btn)b.setAttribute('aria-selected','false');});
  if(id==='radar'){
    if(!isPro()){
      var windEl=document.getElementById('wind-display');
      if(windEl)windEl.innerHTML='<div class="paywall-card fill"><div class="paywall-blurred" style="padding:0;"><div style="display:flex;gap:6px;padding:10px 14px 6px;align-items:center;"><span style="font-size:11px;color:var(--muted);font-weight:600;margin-right:2px;">ALTITUDE</span><span style="background:#38bdf8;color:#020617;border-radius:7px;padding:6px 13px;font-size:12px;font-weight:700;">10m</span><span style="background:var(--bg3);color:var(--muted);border-radius:7px;padding:6px 13px;font-size:12px;font-weight:700;">80m</span><span style="background:var(--bg3);color:var(--muted);border-radius:7px;padding:6px 13px;font-size:12px;font-weight:700;">120m</span></div><div style="margin:4px 14px 10px;background:var(--bg3);border-radius:var(--radius-sm);padding:14px;"><div style="margin-bottom:12px;"><div style="font-size:30px;font-weight:700;color:#22c55e;line-height:1;">12 mph</div><div style="font-size:12px;color:var(--muted);margin-top:2px;">from SW &middot; Gusts 18 mph</div><div style="font-size:11px;color:#22c55e;margin-top:2px;">&#x2713; Flyable &middot; &rarr; Steady</div></div><div style="display:flex;gap:6px;"><div style="flex:1;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.2);border-radius:8px;padding:8px;text-align:center;"><div style="font-size:11px;color:var(--muted);margin-bottom:2px;">10m</div><div style="font-size:15px;font-weight:700;color:#22c55e;">12 mph</div><div style="font-size:11px;color:#22c55e;">&#x2713;</div></div><div style="flex:1;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.2);border-radius:8px;padding:8px;text-align:center;"><div style="font-size:11px;color:var(--muted);margin-bottom:2px;">80m</div><div style="font-size:15px;font-weight:700;color:#f59e0b;">19 mph</div><div style="font-size:11px;color:#f59e0b;">&#x26a0;</div></div><div style="flex:1;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.2);border-radius:8px;padding:8px;text-align:center;"><div style="font-size:11px;color:var(--muted);margin-bottom:2px;">120m</div><div style="font-size:15px;font-weight:700;color:#f59e0b;">24 mph</div><div style="font-size:11px;color:#f59e0b;">&#x26a0;</div></div></div></div><div style="padding:0 14px 14px;"><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Next 72 hours</div><div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;"><div class="whr-time">14:00</div><div style="flex:1;"><div style="font-size:13px;font-weight:600;color:var(--green);">14 mph</div><div style="font-size:11px;color:var(--muted);">Gusts 20 mph &middot; 10m only</div></div><div class="fc-dot green"></div></div><div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;"><div class="whr-time">15:00</div><div style="flex:1;"><div style="font-size:13px;font-weight:600;color:var(--green);">16 mph</div><div style="font-size:11px;color:var(--muted);">Gusts 22 mph &middot; 10m only</div></div><div class="fc-dot green"></div></div><div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;"><div class="whr-time">16:00</div><div style="flex:1;"><div style="font-size:13px;font-weight:600;color:var(--amber);">21 mph</div><div style="font-size:11px;color:var(--amber);">Gusts 29 mph &middot; 10m only</div></div><div class="fc-dot amber"></div></div><div style="padding:10px 0;display:flex;align-items:center;gap:10px;"><div class="whr-time">17:00</div><div style="flex:1;"><div style="font-size:13px;font-weight:600;color:var(--red);">25 mph</div><div style="font-size:11px;color:var(--red);">Gusts 35 mph &middot; 10m only</div></div><div class="fc-dot red"></div></div></div></div><div class="paywall-over">'+proCard({overlay:true,icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>',title:'Wind Detail',sub:'Wind speed, direction and gusts at 10m, 80m and 120m altitude &mdash; plus a 72-hour hourly breakdown.',pills:['📡 10 / 80 / 120m','💨 Gust forecast','⏱ 72-hour outlook','✈️ Altitude limits']})+'</div></div>';
    } else { initWindMap(); }
  }
  if(id==='gh'){
    if(!isPro()){
      var ghEl=document.getElementById('gh-body');
      if(ghEl)ghEl.innerHTML='<div class="paywall-card fill"><div class="paywall-blurred" style="padding:14px;"><div style="font-size:11px;color:var(--muted);letter-spacing:.6px;text-transform:uppercase;margin-bottom:4px;">Today &mdash; Monday 16 June</div><div style="font-size:12px;color:var(--muted);margin-bottom:12px;">&#128205; Your location</div><div class="gh-slot" style="border-left-color:#818cf8;"><div class="gh-slot-header"><div class="gh-slot-name">🌑 Blue Hour &mdash; Dawn</div><div class="gh-slot-time" style="color:#818cf8;">04:12 &ndash; 04:44</div></div><div class="gh-slot-desc">Deep blue pre-dawn sky. Great for moody shots before sunrise.</div></div><div class="gh-slot" style="border-left-color:#f59e0b;"><div class="gh-slot-header"><div class="gh-slot-name">🌅 Golden Hour &mdash; Morning</div><div class="gh-slot-time" style="color:#f59e0b;">04:44 &ndash; 05:23</div></div><div class="gh-slot-desc">Warm, soft light just after sunrise. Long shadows and golden tones.</div></div><div class="gh-slot" style="border-left-color:#f97316;"><div class="gh-slot-header"><div class="gh-slot-name">☀️ Sunrise</div><div class="gh-slot-time" style="color:#f97316;">04:48</div></div><div class="gh-slot-desc">Sun crosses the horizon. Be airborne 10 minutes before.</div></div><div class="gh-slot" style="border-left-color:#f97316;"><div class="gh-slot-header"><div class="gh-slot-name">🌇 Sunset</div><div class="gh-slot-time" style="color:#f97316;">21:21</div></div><div class="gh-slot-desc">Sun crosses the horizon. Most popular time to fly.</div></div><div class="gh-slot" style="border-left-color:#f59e0b;"><div class="gh-slot-header"><div class="gh-slot-name">🌆 Golden Hour &mdash; Evening <span class="gh-badge" style="background:#f59e0b;color:#fff;">LIVE NOW</span></div><div class="gh-slot-time" style="color:#f59e0b;">20:42 &ndash; 21:21</div></div><div class="gh-slot-desc">The classic golden hour. Warm directional light before sunset.</div></div><div class="gh-slot" style="border-left-color:#818cf8;margin-bottom:2px;"><div class="gh-slot-header"><div class="gh-slot-name">🌃 Blue Hour &mdash; Dusk</div><div class="gh-slot-time" style="color:#818cf8;">21:21 &ndash; 21:53</div></div><div class="gh-slot-desc">Deep blue sky after sunset. City lights begin to appear.</div></div><div style="font-size:11px;color:var(--muted);letter-spacing:.6px;text-transform:uppercase;margin:14px 0 8px;">Tomorrow at a Glance</div><div class="gh-tmrw"><div class="gh-tmrw-tile"><div class="gh-tmrw-lbl">🌑 Blue Dawn</div><div class="gh-tmrw-val" style="color:#818cf8;">04:11</div></div><div class="gh-tmrw-tile"><div class="gh-tmrw-lbl">🌅 Golden Morning</div><div class="gh-tmrw-val" style="color:#f59e0b;">04:43</div></div><div class="gh-tmrw-tile"><div class="gh-tmrw-lbl">☀️ Sunrise</div><div class="gh-tmrw-val" style="color:#f97316;">04:47</div></div><div class="gh-tmrw-tile"><div class="gh-tmrw-lbl">🌇 Sunset</div><div class="gh-tmrw-val" style="color:#f97316;">21:22</div></div><div class="gh-tmrw-tile"><div class="gh-tmrw-lbl">🌆 Golden Eve</div><div class="gh-tmrw-val" style="color:#f59e0b;">20:43</div></div><div class="gh-tmrw-tile"><div class="gh-tmrw-lbl">🌃 Blue Dusk</div><div class="gh-tmrw-val" style="color:#818cf8;">21:54</div></div></div></div><div class="paywall-over">'+proCard({overlay:true,icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',title:'Golden Hour',sub:'Precise golden hour, blue hour and sunrise &amp; sunset times, plus a live sun-path map and sunrise/sunset quality score for your exact location.',pills:['🌅 Golden hour','🌑 Blue hour','🗺️ Sun path map','☀️ Sunrise/Sunset %','📷 Photo conditions','⏱ Live countdown']})+'</div></div>';
    } else { renderGolden(); ghRefreshTimer=setInterval(renderGolden,600000); }
  }
  if(id==='cl')renderChecklist();
  if(id==='rules')renderRules();
  if(id==='log'){
    if(!isPro()){
      var logEl=document.getElementById('log-body');
      if(logEl)logEl.innerHTML='<div class="paywall-card fill"><div class="paywall-blurred" style="padding:0;"><div style="display:flex;gap:8px;padding:14px 14px 10px;"><div style="flex:1;background:var(--bg3);border-radius:8px;padding:10px;text-align:center;"><div style="font-size:22px;font-weight:700;color:var(--text);">12</div><div style="font-size:10px;color:var(--muted);">flights</div></div><div style="flex:1;background:var(--bg3);border-radius:8px;padding:10px;text-align:center;"><div style="font-size:17px;font-weight:700;color:var(--text);">4h 20m</div><div style="font-size:10px;color:var(--muted);">total time</div></div><div style="flex:1;background:var(--bg3);border-radius:8px;padding:10px;text-align:center;"><div style="font-size:22px;font-weight:700;color:var(--text);">5</div><div style="font-size:10px;color:var(--muted);">locations</div></div></div><div class="log-count">12 flights logged</div><div class="log-entry"><div class="log-entry-hdr"><div><div class="log-entry-loc">Hyde Park, London</div></div><div class="log-entry-date">2026-06-14 &middot; 11:32</div></div><div class="log-entry-tags"><span class="log-tag">🚁 DJI Mini 4 Pro</span><span class="log-tag">⏱ 28 mins</span><span class="log-tag">Photography</span><span class="log-tag green">Good to Fly</span></div></div><div class="log-entry"><div class="log-entry-hdr"><div><div class="log-entry-loc">Box Hill, Surrey</div></div><div class="log-entry-date">2026-06-12 &middot; 09:15</div></div><div class="log-entry-tags"><span class="log-tag">🚁 DJI Mini 4 Pro</span><span class="log-tag">⏱ 45 mins</span><span class="log-tag">Recreation</span><span class="log-tag amber">Fly with Caution</span></div></div><div class="log-entry"><div class="log-entry-hdr"><div><div class="log-entry-loc">Snowdonia, Wales</div></div><div class="log-entry-date">2026-06-08 &middot; 07:50</div></div><div class="log-entry-tags"><span class="log-tag">🚁 DJI Air 3</span><span class="log-tag">⏱ 32 mins</span><span class="log-tag">Photography</span><span class="log-tag green">Good to Fly</span></div></div><div class="log-entry"><div class="log-entry-hdr"><div><div class="log-entry-loc">Brighton Beach</div></div><div class="log-entry-date">2026-06-05 &middot; 18:44</div></div><div class="log-entry-tags"><span class="log-tag">🚁 DJI Air 3</span><span class="log-tag">⏱ 19 mins</span><span class="log-tag">Recreation</span><span class="log-tag green">Good to Fly</span></div></div></div><div class="paywall-over">'+proCard({overlay:true,icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',title:'Flight Log',sub:'Log every flight with date, location, drone and conditions. Export to Excel or Google Sheets.',pills:['✏️ Log flights','📍 Locations','📊 Stats','☁️ Device sync','📤 Excel export']})+'</div></div>';
    } else {
      // Render immediately with local data, then sync from cloud in background
      renderLog();
      if(proUser&&proUser.uid){
        if(_fbLoaded){
          syncFlightsFromCloud(proUser.uid,function(){renderLog();});
        } else {
          loadFirebase(function(){
            syncFlightsFromCloud(proUser.uid,function(){renderLog();});
          });
        }
      }
    }
  }
  if(id==='restrict')renderRestrictionsTab();
}
function applyDeepLink(){
  try{
    var params=new URLSearchParams(window.location.search);
    var tab=params.get('tab');
    if(!tab)return;
    var validTabs={'dash':1,'fc':1,'radar':1,'gh':1,'log':1,'rules':1};
    if(!validTabs[tab])return;
    var btn=document.getElementById('nb-'+tab);
    if(btn){
      goTab(tab,btn);
      if(window.history&&window.history.replaceState){
        window.history.replaceState({},'','/app.html');
      }
    } else if (tab === 'rules') {
      openRules();
      if(window.history&&window.history.replaceState){
        window.history.replaceState({},'','/app.html');
      }
    }
  }catch(e){}
}
window.addEventListener('load',function(){
  checkDisclaimer();
  handleStripeReturn();
  loadProUser();loadProThresholds();updateProUI();initCustomDroneUI();
  if(isPro())setTimeout(prefetchSavedLocations,3000);
  loadDrone();loadChecklist();loadUnits();renderFavBar();

  var cached=loadWxCache();
  var lastLoc=loadLastLoc();

  // Step 1: Show cached data immediately while we fetch fresh
  if(cached){
    wxData=cached.data;
    if(lastLoc){uLat=lastLoc.lat;uLng=lastLoc.lng;document.getElementById('loc-name').textContent=lastLoc.name;renderFavBar();}
    else{
      // Cached data exists but no saved location (e.g. older app version). Use London as a
      // safe coordinate fallback so fetchAll/manualRefresh don't fail with null coords;
      // getLoc() will overwrite both as soon as GPS resolves.
      uLat=51.5074;uLng=-0.1278;
      document.getElementById('loc-name').textContent='Locating...';
    }
    hideSplash();renderDash();renderFc();renderGolden();showOfflineBanner(cached.ts);
  } else if(lastLoc){
    uLat=lastLoc.lat;uLng=lastLoc.lng;
    document.getElementById('loc-name').textContent=lastLoc.name;
    renderFavBar();
  } else {
    uLat=51.5074;uLng=-0.1278;
    document.getElementById('loc-name').textContent='Locating...';
  }

  // Step 2: Always fetch fresh weather immediately with whatever coords we have.
  // This is decoupled from geolocation — blocked/slow GPS never prevents a refresh.
  loadKpCache();
  fetchAll();

  // Step 3: Try geolocation in the background to get accurate position.
  getLoc();

  // Re-fetch with fresh GPS if app was backgrounded 10+ minutes
  // (e.g. user just landed at a new airport and reopened the app)
  var _hiddenAt=null;
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){
      _hiddenAt=Date.now();
    } else {
      var away=_hiddenAt?Date.now()-_hiddenAt:0;
      if(away>600000){showToast('Checking your location...');getLoc(true);}
    }
  });

  startIntervals();
  setTimeout(function(){hideSplash();},5000);
  setTimeout(applyDeepLink,600);
});
var PAID_FEATURES_ENABLED=true;
// proUser, loadProUser, saveProUser, isPro — defined below with Firebase integration
// ---- Stripe checkout ----
var CHECKOUT_URL='https://us-central1-dronechecker.cloudfunctions.net/createCheckoutSession';
var DELETE_ACCOUNT_URL='https://us-central1-dronechecker.cloudfunctions.net/deleteAccount';
var _selectedPlan='monthly'; // 'monthly' or 'yearly'

function selectPlan(plan){
  _selectedPlan=plan;
  var mBtn=document.getElementById('plan-monthly-btn');
  var yBtn=document.getElementById('plan-yearly-btn');
  var amt=document.getElementById('plan-price-amt');
  var per=document.getElementById('plan-price-per');
  var note=document.getElementById('plan-price-note');
  var subBtn=document.getElementById('pro-subscribe-btn');
  if(plan==='yearly'){
    if(mBtn){mBtn.style.background='transparent';mBtn.style.color='var(--muted)';}
    if(yBtn){yBtn.style.background='#1e40af';yBtn.style.color='#fff';}
    if(amt){amt.innerHTML='&pound;29.99';}
    if(per){per.textContent='/ year';}
    if(note){note.innerHTML='That\'s &pound;2.50/month &middot; Save &pound;17.89 vs monthly';}
    if(subBtn){subBtn.innerHTML='Get Pro &middot; &pound;29.99/year';}
  } else {
    if(mBtn){mBtn.style.background='#1e40af';mBtn.style.color='#fff';}
    if(yBtn){yBtn.style.background='transparent';yBtn.style.color='var(--muted)';}
    if(amt){amt.innerHTML='&pound;3.99';}
    if(per){per.textContent='/ month';}
    if(note){note.textContent='Cancel anytime \u00b7 Secure payment via Stripe';}
    if(subBtn){subBtn.innerHTML='Get Pro &middot; &pound;3.99/month';}
  }
}

function handleSubscribe(){
  if(!proUser||!proUser.uid||!proUser.email){
    showProSignin();
    return;
  }
  startStripeCheckout();
}

// Defense-in-depth: only ever follow a redirect URL that points to Stripe.
function isStripeUrl(u){
  try{
    var h=new URL(u, window.location.origin).hostname;
    return h==='stripe.com' || /\.stripe\.com$/.test(h);
  }catch(e){return false;}
}

function startStripeCheckout(){
  var btn=document.getElementById('pro-subscribe-btn');
  if(btn){btn.textContent='Loading…';btn.disabled=true;}
  var reset=function(){if(btn){btn.textContent=_selectedPlan==='yearly'?'Get Pro · £29.99/year':'Get Pro · £3.99/month';btn.disabled=false;}};
  if(!_fbLoaded||!firebase.auth().currentUser){
    showToast('Authentication error. Please sign in again.');
    reset();return;
  }
  firebase.auth().currentUser.getIdToken().then(function(idToken){
    return fetch(CHECKOUT_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+idToken},
      body:JSON.stringify({uid:proUser.uid,email:proUser.email,plan:_selectedPlan})
    }).then(function(r){return r.json();}).then(function(data){
      if(data.url&&isStripeUrl(data.url)){window.location.href=data.url;}
      else{showToast('Could not start checkout. Please try again.');reset();}
    });
  }).catch(function(){
    showToast('Could not start checkout. Check your connection.');
    reset();
  });
}

// Handle return from Stripe Checkout
function handleStripeReturn(){
  try{
    var params=new URLSearchParams(window.location.search);
    var pro=params.get('pro');
    if(!pro)return;
    // Clean the URL
    window.history.replaceState({},'','/app.html');
    if(pro==='success'){
      // Payment succeeded — refresh Pro status from Firestore
      showToast('Payment successful! Activating Pro…');
      setTimeout(function(){
        if(_fbLoaded&&proUser){
          fetchProStatus(proUser.uid,function(isProStatus){
            if(isProStatus){
              proUser.isPro=true;
              saveProUser(proUser);
              updateProUI();
              if(typeof renderRestrictionsTab==='function')renderRestrictionsTab();
              renderFavBar();
              if(wxData){renderDash();renderFc();}
              showProWelcomeScreen();
            } else {
              // Webhook may not have fired yet — retry once after 3s
              setTimeout(function(){
                fetchProStatus(proUser.uid,function(s){
                  if(s){
                    proUser.isPro=true;saveProUser(proUser);updateProUI();
                    if(typeof renderRestrictionsTab==='function')renderRestrictionsTab();
                    renderFavBar();
                    if(wxData){renderDash();renderFc();}
                    showProWelcomeScreen();
                  } else {
                    showToast('Payment received — Pro will activate shortly.');
                  }
                });
              },3000);
            }
          });
        }
      },1500);
    } else if(pro==='cancelled'){
      showToast('Checkout cancelled — no charge made.');
    }
  }catch(e){}
}

function restoreOverlay(){
  var o=document.getElementById('pro-overlay');
  if(o){o.style.display='flex';o.style.zIndex='';}
  document.body.style.overflow='hidden';
}
function openProOverlay(){
  if(!PAID_FEATURES_ENABLED)return;
  var o=document.getElementById('pro-overlay');
  if(!o)return;
  if(isPro()){showProSignedIn();}else{showProUpgrade();}
  o.style.display='flex';
  document.body.style.overflow='hidden';
  // Preload Firebase and GSI in the background so they're ready
  // when the user taps "Continue with Google" — avoids Safari popup blocking
  loadFirebase(function(){
    loadGSI(function(){
      // Pre-initialise GSI so the callback is registered and ready
      try{
        if(window.google&&window.google.accounts&&window.google.accounts.id){
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: window._gsiCallback||function(){},
            ux_mode: 'popup',
            cancel_on_tap_outside: false
          });
        }
      }catch(e){}
    });
  });
}
function closeProOverlay(){var o=document.getElementById('pro-overlay');if(o)o.style.display='none';document.body.style.overflow='';}
function showProUpgrade(){
  var u=document.getElementById('pro-screen-upgrade'),s=document.getElementById('pro-screen-signin');
  if(u)u.style.display='';
  if(s)s.style.display='none';
  // Reset the sign-in button
  var btn=document.getElementById('pro-google-signin-btn');
  if(btn){btn.style.opacity='1';btn.disabled=false;}
  // If already signed in, update the subscribe button to go straight to checkout
  var subBtn=document.getElementById('pro-subscribe-btn');
  if(subBtn){
    if(proUser&&!proUser.isPro){
      subBtn.textContent='Subscribe as '+((proUser.name||'').split(' ')[0]||proUser.email||'you')+' · £3.99/month';
    } else {
      subBtn.textContent='Get Pro · £3.99/month';
    }
    subBtn.disabled=false;
  }
}
function showProSignin(){var u=document.getElementById('pro-screen-upgrade'),s=document.getElementById('pro-screen-signin');if(u)u.style.display='none';if(s)s.style.display='';}
function showProSignedIn(){var sheet=document.getElementById('pro-sheet');if(!sheet||!proUser)return;var initials=(proUser.name||proUser.email||'U').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();sheet.innerHTML='<div class="pro-sheet-header"><div style="width:24px;"></div><div style="font-size:13px;font-weight:600;color:var(--muted);">Your Pro Account</div><button class="pro-close" onclick="closeProOverlay()">&times;</button></div><div class="pro-body" style="padding-top:12px;"><div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);margin-bottom:12px;"><div class="pro-avatar">'+esc(initials)+'</div><div style="flex:1;"><div style="font-size:14px;font-weight:600;color:var(--text);">'+esc(proUser.name||'')+'</div><div style="font-size:11px;color:var(--muted);">'+esc(proUser.email||'')+'</div><div style="font-size:11px;color:#f59e0b;font-weight:600;margin-top:2px;">DroneChecker Pro</div></div></div><div style="font-size:12px;color:var(--muted);line-height:1.7;margin-bottom:16px;">Subscription: <strong style="color:var(--green);">Active</strong></div><button onclick="signOutPro()" style="width:100%;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);border-radius:var(--radius-sm);padding:12px;color:var(--red);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:8px;">Sign out</button>'+buildThresholdUI()+'<button onclick="closeProOverlay()" style="width:100%;background:transparent;border:1px solid var(--border);border-radius:var(--radius-sm);padding:11px;color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Close</button></div>';}
var GOOGLE_CLIENT_ID='62546050100-qkdhvc5g77a1kn423u44jrisgmakgigg.apps.googleusercontent.com';

var proUser=null;
var _droneIds=null;
var _lastCloudSync=null; // timestamp of last successful cloud sync

function loadProUser(){
  // First restore from localStorage for instant UI (no flicker)
  try{var s=localStorage.getItem('dc_pro_user');if(s)proUser=JSON.parse(s);}catch(e){}
  // Then silently restore Firebase session in the background and re-check isPro from Firestore
  // This ensures isPro is always fresh from the server, not just from localStorage
  try{
    restoreFirebaseSession(function(restored){
      if(restored){
        proUser=restored;
        try{localStorage.setItem('dc_pro_user',JSON.stringify(restored));}catch(e){}
        updateProUI();
        // isPro may have just flipped (e.g. localStorage was stale/empty) — the
        // dashboard already rendered once with the pre-confirmation status, so
        // force it to redraw with the server-confirmed value. See loadProUser().
        _lastDashSig=null;if(wxData){renderDash();renderFc();}
        if(isPro())setTimeout(prefetchSavedLocations,1000);
      } else if(proUser){
        // Firebase says no session — clear stale localStorage
        proUser=null;
        try{localStorage.removeItem('dc_pro_user');}catch(e){}
        updateProUI();
        _lastDashSig=null;if(wxData){renderDash();renderFc();}
      }
    });
  }catch(e){}
}

function saveProUser(u){
  proUser=u;
  try{localStorage.setItem('dc_pro_user',u?JSON.stringify(u):'');}catch(e){}
}

function isPro(){return PAID_FEATURES_ENABLED&&proUser&&proUser.isPro;}

// ---- Email auth mode: 'signin' or 'signup' ----
var _emailMode='signin';

function toggleEmailForm(){
  var form=document.getElementById('pro-email-form');
  var showBtn=document.getElementById('pro-show-email-btn');
  if(!form)return;
  var isActive=form.classList.contains('active');
  if(isActive){
    form.classList.remove('active');
    if(showBtn)showBtn.textContent='Sign in with email instead';
  } else {
    form.classList.add('active');
    if(showBtn)showBtn.textContent='Use Google instead';
    setTimeout(function(){var inp=document.getElementById('pro-email-input');if(inp)inp.focus();},100);
  }
  setEmailError('');
}

function toggleEmailMode(mode){
  _emailMode=mode;
  var btn=document.getElementById('pro-email-btn');
  var toggle=document.getElementById('pro-auth-toggle');
  var pwInput=document.getElementById('pro-password-input');
  var signupFields=document.getElementById('pro-signup-fields');
  var confirmInput=document.getElementById('pro-confirm-password-input');
  if(mode==='signup'){
    if(btn)btn.textContent='Create account';
    if(toggle)toggle.innerHTML='Already have one? <a onclick="toggleEmailMode(&apos;signin&apos;)">Sign in</a>';
    if(pwInput){pwInput.placeholder='Password (min 6 characters)';pwInput.autocomplete='new-password';}
    if(signupFields)signupFields.style.display='flex';
    if(confirmInput)confirmInput.style.display='';
  } else {
    if(btn)btn.textContent='Sign in';
    if(toggle)toggle.innerHTML='No account? <a onclick="toggleEmailMode(&apos;signup&apos;)">Create one</a>';
    if(pwInput){pwInput.placeholder='Password';pwInput.autocomplete='current-password';}
    if(signupFields)signupFields.style.display='none';
    if(confirmInput)confirmInput.style.display='none';
  }
  setEmailError('');
}

function setEmailError(msg,isSuccess){
  var el=document.getElementById('pro-auth-error');
  if(el){el.textContent=msg||'';el.classList.toggle('success',!!isSuccess);}
}

function handleEmailSignIn(){
  var email=(document.getElementById('pro-email-input')||{}).value||'';
  var password=(document.getElementById('pro-password-input')||{}).value||'';
  var firstName=(document.getElementById('pro-first-name-input')||{}).value||'';
  var lastName=(document.getElementById('pro-last-name-input')||{}).value||'';
  var confirmPassword=(document.getElementById('pro-confirm-password-input')||{}).value||'';
  var btn=document.getElementById('pro-email-btn');

  email=email.trim();firstName=firstName.trim();lastName=lastName.trim();
  if(!email||!password){setEmailError('Please enter your email and password.');return;}
  if(password.length<6){setEmailError('Password must be at least 6 characters.');return;}
  if(_emailMode==='signup'){
    if(!firstName||!lastName){setEmailError('Please enter your first and last name.');return;}
    if(password!==confirmPassword){setEmailError('Passwords do not match.');return;}
  }

  setEmailError('');
  if(btn){btn.disabled=true;btn.textContent='Please wait…';}

  loadFirebase(function(){
    var authFn=_emailMode==='signup'
      ? firebase.auth().createUserWithEmailAndPassword(email,password)
      : firebase.auth().signInWithEmailAndPassword(email,password);

    authFn.then(function(result){
      var fbUser=result.user;
      if(_emailMode==='signup'){
        fbUser.updateProfile({displayName:(firstName+' '+lastName).trim()}).catch(function(){});
        fbUser.sendEmailVerification().catch(function(){});
        firebase.auth().signOut();
        if(btn){btn.disabled=false;btn.textContent='Create account';}
        toggleEmailMode('signin');
        setEmailError('Account created! Check your inbox and verify your email before signing in.',true);
        return;
      }
      if(!fbUser.emailVerified){
        fbUser.sendEmailVerification().catch(function(){});
        firebase.auth().signOut();
        if(btn){btn.disabled=false;btn.textContent='Sign in';}
        setEmailError('Email not verified. A new verification link has been sent to '+esc(fbUser.email)+'.');
        return;
      }
      fetchProStatus(fbUser.uid,function(isProStatus){
        if(btn){btn.disabled=false;btn.textContent='Sign in';}
        onGoogleSignInSuccess({
          uid:fbUser.uid,
          name:fbUser.displayName||email.split('@')[0],
          email:fbUser.email,
          photoUrl:fbUser.photoURL||'',
          isPro:isProStatus
        });
      });
    }).catch(function(e){
      if(btn){btn.disabled=false;btn.textContent=_emailMode==='signup'?'Create account':'Sign in';}
      var msg='Something went wrong. Please try again.';
      if(e.code==='auth/user-not-found'||e.code==='auth/wrong-password'||e.code==='auth/invalid-credential'){
        msg='Incorrect email or password.';
      } else if(e.code==='auth/email-already-in-use'){
        msg='An account with this email already exists.';
        toggleEmailMode('signin');
      } else if(e.code==='auth/invalid-email'){
        msg='Please enter a valid email address.';
      } else if(e.code==='auth/too-many-requests'){
        msg='Too many attempts. Please try again later.';
      } else if(e.code==='auth/weak-password'){
        msg='Password must be at least 6 characters.';
      }
      setEmailError(msg);
    });
  });
}

function handleForgotPassword(){
  var email=(document.getElementById('pro-email-input')||{}).value||'';
  email=email.trim();
  if(!email){setEmailError('Enter your email address above first.');return;}
  loadFirebase(function(){
    firebase.auth().sendPasswordResetEmail(email).then(function(){
      setEmailError('');
      showToast('Password reset email sent to '+email);
    }).catch(function(e){
      if(e.code==='auth/user-not-found'){
        setEmailError('No account found with that email.');
      } else {
        setEmailError('Could not send reset email. Please try again.');
      }
    });
  });
}

function handleGoogleSignIn(){
  var btn=document.getElementById('pro-google-signin-btn');

  function proceedWithSignIn(){
    if(btn){btn.style.opacity='0.6';btn.disabled=true;}

  // Close the overlay so the Google popup appears on top unobstructed
  var overlay=document.getElementById('pro-overlay');
  if(overlay)overlay.style.display='none';
  document.body.style.overflow='';

  // PRODUCTION: Use GSI to get a Google ID token, then exchange for Firebase session.
  // Firebase and GSI are preloaded when the overlay opens, so this fires synchronously
  // within the user gesture window — required for Safari popup support.
  function _doGSISignIn(){
    try{
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: function(response){
            if(!response||!response.credential){
              if(btn){btn.style.opacity='1';btn.disabled=false;}
              showToast('Sign-in cancelled.');
              return;
            }
            // Exchange Google ID token for Firebase credential
            var googleCred=firebase.auth.GoogleAuthProvider.credential(response.credential);
            firebase.auth().signInWithCredential(googleCred).then(function(result){
              var fbUser=result.user;
              restoreOverlay();
              fetchProStatus(fbUser.uid,function(isProStatus){
                if(btn){btn.style.opacity='1';btn.disabled=false;}
                onGoogleSignInSuccess({
                  uid:      fbUser.uid,
                  name:     fbUser.displayName||fbUser.email,
                  email:    fbUser.email,
                  photoUrl: fbUser.photoURL||'',
                  isPro:    isProStatus
                });
              });
            }).catch(function(e){
              restoreOverlay();
              if(btn){btn.style.opacity='1';btn.disabled=false;}
              showToast('Sign-in failed. Please try again.');
              console.error('[DC] signInWithCredential error:',e);
            });
          },
          ux_mode: 'popup',
          cancel_on_tap_outside: false,
          use_fedcm_for_prompt: false
        });
        // Show the Google One Tap / sign-in button
        google.accounts.id.prompt(function(notification){
          if(notification.isNotDisplayed()||notification.isSkippedMoment()){
            // One Tap suppressed — render the button and click it
            var container=document.getElementById('pro-google-signin-btn');
            google.accounts.id.renderButton(container,{
              theme:'filled_black',size:'large',width:280,
              text:'continue_with',shape:'rectangular'
            });
            setTimeout(function(){
              var iframe=container.querySelector('iframe');
              if(iframe)iframe.click();
              else{if(btn){btn.style.opacity='1';btn.disabled=false;}}
            },300);
          }
        });
      }catch(e){
        if(btn){btn.style.opacity='1';btn.disabled=false;}
        restoreOverlay();
        showToast('Sign-in error. Please try again.');
        console.error('[DC] GSI error:',e);
      }
  }

  // Safari sign-in now works via redirect since authDomain is dronechecker.co.uk (Firebase Hosting)

  // TWA (Android app): use Firebase signInWithRedirect — GSI popup is blocked in TWA
  if(isStandalone && /Android/.test(navigator.userAgent)){
    loadFirebase(function(){
      try{
        var provider = new firebase.auth.GoogleAuthProvider();
        try{localStorage.setItem('dc_redirect_ts', Date.now().toString());}catch(e){}
        firebase.auth().signInWithRedirect(provider);
      }catch(e){
        if(btn){btn.style.opacity='1';btn.disabled=false;}
        restoreOverlay();
        showToast('Sign-in error. Please try again.');
        console.error('[DC] signInWithRedirect error:',e);
      }
    });
    return;
  }

  // Non-TWA: use GSI popup (works in Edge, Chrome, desktop, Safari via Firebase Hosting)
  if(_fbLoaded && window.google && window.google.accounts){
    _doGSISignIn();
  } else {
    loadFirebase(function(){
      loadGSI(function(){
        _doGSISignIn();
      });
    });
  }
  } // end proceedWithSignIn

  // Detect incognito using Storage Quota API — most reliable cross-browser method
  // Normal mode: quota is several GB. Chrome/Samsung incognito: ~120MB
  if(navigator.storage&&navigator.storage.estimate){
    navigator.storage.estimate().then(function(estimate){
      if(estimate.quota&&estimate.quota<200*1024*1024){
        showToast('⚠️ Google sign-in is blocked in private/incognito mode. Please open DroneChecker in a normal browser tab, or use Continue with Email instead.');
        if(btn){btn.style.opacity='1';btn.disabled=false;}
      } else {
        proceedWithSignIn();
      }
    }).catch(function(){proceedWithSignIn();});
  } else {
    proceedWithSignIn();
  }
}

function onGoogleSignInSuccess(user){
  saveProUser(user);
  updateProUI();
  initCustomDroneUI();
  var firstName=user.name?(user.name.split(' ')[0]||'there'):'there';
  if(user.isPro){
    closeProOverlay();
    showToast('Welcome back, '+firstName+'! Pro is active.');
    if(typeof renderRestrictionsTab==='function')renderRestrictionsTab();
    renderFavBar();
    if(wxData){renderDash();renderFc();}
    syncFlightsFromCloud(user.uid,null);
    syncThresholdsFromCloud(user.uid,null);
    syncAlertSettingsFromCloud(user.uid,null);
    syncDroneIdsFromCloud(user.uid,function(){_lastDashSig=null;if(wxData)renderDash();});
    syncFavsFromCloud(user.uid,null);
  } else {
    showProUpgrade();
  }
}

function signOutPro(){
  if(!confirm('Sign out of Pro?\n\nYour free features continue to work.'))return;
  saveProUser(null);
  try{localStorage.removeItem('dc_pro_user');}catch(e){}
  if(_fbLoaded){
    firebase.auth().signOut().catch(function(){});
  }
  updateProUI();
  renderFavBar();
  var cb=document.getElementById('custom-drone-btn');if(cb)cb.remove();
  initCustomDroneUI();
  closeProOverlay();
  showToast('Signed out of Pro');
  if(wxData){renderDash();renderFc();}
}
function openThresholdSheet(){
  if(!isPro()){openProOverlay();return;}
  // Pull latest thresholds from Firestore before rendering the sheet
  if(proUser&&proUser.uid)syncThresholdsFromCloud(proUser.uid,null);
  var overlay=document.getElementById('thr-sheet-overlay');
  var body=document.getElementById('thr-sheet-body');
  if(!overlay||!body)return;
  var d=getDrone();
  var isCustom=hasCustomThresholds();
  var t=getThresholds();
  function row(id,label,val,max,cls){
    var pct=Math.round(val/max*100);
    return '<div class="threshold-row">'+
      '<div class="threshold-label">'+label+'</div>'+
      '<input class="threshold-slider '+cls+'" type="range" min="5" max="'+max+'" step="1" value="'+val+'" style="--pct:'+pct+'%" oninput="updateThresholdSlider(this,&apos;'+id+'&apos;)" onchange="applyThreshold(&apos;'+id+'&apos;,this.value)">'+
      '<div class="threshold-val" id="thr-val-'+id+'">'+thrDisp(val)+'</div>'+
    '</div>';
  }
  body.innerHTML=
    '<div class="thr-drone-name">'+esc(d.name)+(isCustom?' \u2022 Custom':' \u2022 Default')+'</div>'+
    '<div class="thr-hint">Adjust when conditions turn amber or red for this drone. Changes apply instantly.</div>'+
    row('windAmber','Wind caution',t.windAmber,80,'amber')+
    row('windRed','Wind avoid',t.windRed,80,'red')+
    row('gustAmber','Gust caution',t.gustAmber,100,'amber')+
    row('gustRed','Gust avoid',t.gustRed,100,'red')+
    (isCustom?'<div class="threshold-reset" onclick="resetProThresholds()">Reset to '+esc(d.name)+' defaults</div>':'');
  overlay.classList.add('open');
  document.body.style.overflow='hidden';
  var btn=document.getElementById('thr-btn');
  if(btn)btn.classList.add('active');
}
function closeThresholdSheet(){
  var overlay=document.getElementById('thr-sheet-overlay');
  if(overlay)overlay.classList.remove('open');
  document.body.style.overflow='';
  var btn=document.getElementById('thr-btn');
  if(btn)btn.classList.remove('active');
}

function updateProUI(){
  // Swap header logo — gold border for Pro, plain for free
  var logo=document.getElementById('header-logo');
  if(logo){
    if(isPro()){
      logo.innerHTML='<rect width="100" height="100" rx="20" fill="#0f172a"/><rect width="100" height="100" rx="20" fill="none" stroke="#f59e0b" stroke-width="6"/><circle cx="50" cy="50" r="32" fill="none" stroke="#38bdf8" stroke-width="3.5"/><line x1="50" y1="50" x2="21" y2="21" stroke="white" stroke-width="9" stroke-linecap="round"/><line x1="50" y1="50" x2="79" y2="21" stroke="white" stroke-width="9" stroke-linecap="round"/><line x1="50" y1="50" x2="21" y2="79" stroke="white" stroke-width="9" stroke-linecap="round"/><line x1="50" y1="50" x2="79" y2="79" stroke="white" stroke-width="9" stroke-linecap="round"/><circle cx="21" cy="21" r="13" fill="none" stroke="#38bdf8" stroke-width="4"/><circle cx="79" cy="21" r="13" fill="none" stroke="#38bdf8" stroke-width="4"/><circle cx="21" cy="79" r="13" fill="none" stroke="#38bdf8" stroke-width="4"/><circle cx="79" cy="79" r="13" fill="none" stroke="#38bdf8" stroke-width="4"/><rect x="14" y="18" width="14" height="6" rx="2" fill="white" transform="rotate(-45 21 21)"/><rect x="72" y="18" width="14" height="6" rx="2" fill="white" transform="rotate(45 79 21)"/><rect x="14" y="76" width="14" height="6" rx="2" fill="white" transform="rotate(45 21 79)"/><rect x="72" y="76" width="14" height="6" rx="2" fill="white" transform="rotate(-45 79 79)"/><circle cx="50" cy="50" r="11" fill="white"/><circle cx="50" cy="50" r="5.5" fill="#0f172a"/>';
    } else {
      logo.innerHTML='<rect width="100" height="100" rx="20" fill="#0f172a"/><circle cx="50" cy="50" r="32" fill="none" stroke="#38bdf8" stroke-width="3.5"/><line x1="50" y1="50" x2="21" y2="21" stroke="white" stroke-width="9" stroke-linecap="round"/><line x1="50" y1="50" x2="79" y2="21" stroke="white" stroke-width="9" stroke-linecap="round"/><line x1="50" y1="50" x2="21" y2="79" stroke="white" stroke-width="9" stroke-linecap="round"/><line x1="50" y1="50" x2="79" y2="79" stroke="white" stroke-width="9" stroke-linecap="round"/><circle cx="21" cy="21" r="13" fill="none" stroke="#38bdf8" stroke-width="4"/><circle cx="79" cy="21" r="13" fill="none" stroke="#38bdf8" stroke-width="4"/><circle cx="21" cy="79" r="13" fill="none" stroke="#38bdf8" stroke-width="4"/><circle cx="79" cy="79" r="13" fill="none" stroke="#38bdf8" stroke-width="4"/><rect x="14" y="18" width="14" height="6" rx="2" fill="white" transform="rotate(-45 21 21)"/><rect x="72" y="18" width="14" height="6" rx="2" fill="white" transform="rotate(45 79 21)"/><rect x="14" y="76" width="14" height="6" rx="2" fill="white" transform="rotate(45 21 79)"/><rect x="72" y="76" width="14" height="6" rx="2" fill="white" transform="rotate(-45 79 79)"/><circle cx="50" cy="50" r="11" fill="white"/><circle cx="50" cy="50" r="5.5" fill="#0f172a"/>';
    }
  }
  // PRO badges on locked nav tabs
  ['radar','restrict','gh','log'].forEach(function(id){
    var btn=document.getElementById('nb-'+id);
    if(!btn)return;
    var existing=btn.querySelector('.nb-pro-badge');
    if(isPro()){if(existing)existing.remove();}
    else if(!existing){
      var b=document.createElement('span');
      b.className='nb-pro-badge';
      b.textContent='PRO';
      b.style.cssText='font-size:7px;font-weight:700;color:#f59e0b;background:rgba(245,158,11,.15);border-radius:3px;padding:1px 3px;letter-spacing:.3px;line-height:1;margin-top:1px;';
      btn.appendChild(b);
    }
  });
  if(!PAID_FEATURES_ENABLED)return;
  var pill=document.getElementById('pro-header-pill');
  var badge=document.getElementById('pro-title-badge');
  if(!pill)return;
  if(isPro()&&proUser){
    // Pro — pill hidden, gold logo + "Pro" badge communicates status
    pill.style.display='none';
    if(badge)badge.style.display='inline';
    // Location can use more space with no pill
    var locWrap=document.getElementById('header-loc');
    if(locWrap){var ln=document.getElementById('loc-name');if(ln)ln.style.maxWidth='180px';}
  } else {
    // Free — show Go Pro CTA, keep location narrower
    pill.style.display='flex';
    if(badge)badge.style.display='none';
    var locWrap=document.getElementById('header-loc');
    if(locWrap){var ln=document.getElementById('loc-name');if(ln)ln.style.maxWidth='100px';}
    pill.innerHTML='<svg width="11" height="11" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#0f172a"/><rect width="100" height="100" rx="20" fill="none" stroke="#f59e0b" stroke-width="4"/><circle cx="50" cy="50" r="32" fill="none" stroke="#38bdf8" stroke-width="3.5"/><line x1="50" y1="50" x2="21" y2="21" stroke="white" stroke-width="9" stroke-linecap="round"/><line x1="50" y1="50" x2="79" y2="21" stroke="white" stroke-width="9" stroke-linecap="round"/><line x1="50" y1="50" x2="21" y2="79" stroke="white" stroke-width="9" stroke-linecap="round"/><line x1="50" y1="50" x2="79" y2="79" stroke="white" stroke-width="9" stroke-linecap="round"/><circle cx="21" cy="21" r="13" fill="none" stroke="#38bdf8" stroke-width="4"/><circle cx="79" cy="21" r="13" fill="none" stroke="#38bdf8" stroke-width="4"/><circle cx="21" cy="79" r="13" fill="none" stroke="#38bdf8" stroke-width="4"/><circle cx="79" cy="79" r="13" fill="none" stroke="#38bdf8" stroke-width="4"/><circle cx="50" cy="50" r="11" fill="white"/><circle cx="50" cy="50" r="5.5" fill="#0f172a"/></svg><span id="pro-pill-label">Go Pro</span>';
    pill.title='Upgrade to DroneChecker Pro';
  }
  // Refresh drone limits display (adds/removes pencil icon based on Pro status)
  updateDroneLimits();
}
// Shared upsell card — gradient banner, left icon, feature pills, gradient CTA.
// Pure HTML builder; callers handle their own isPro()/PAID_FEATURES_ENABLED gating.
// opts: {id, icon (inner <svg> string), title, sub, pills (label strings), cta, overlay}
function proCard(opts){opts=opts||{};var cls='pro-card'+(opts.overlay?' in-overlay':'');var pills=(opts.pills||[]).map(function(p){return'<span class="pro-card-pill">'+p+'</span>';}).join('');var cta=opts.cta||'Unlock with Pro &middot; &pound;3.99/mo &rarr;';return'<div class="'+cls+'"'+(opts.id?' id="'+opts.id+'"':'')+' role="button" tabindex="0" onclick="openProOverlay()" onkeydown="if(event.key===&apos;Enter&apos;||event.key===&apos; &apos;){event.preventDefault();openProOverlay();}"><div class="pro-card-hd"><div class="pro-card-ico">'+(opts.icon||'')+'</div><div class="pro-card-tx"><div class="pro-card-ttl">'+(opts.title||'')+'</div><div class="pro-card-sub">'+(opts.sub||'')+'</div></div></div><div class="pro-card-pills">'+pills+'</div><div class="pro-card-cta">'+cta+'</div></div>';}
var PRO_LOCK_SVG='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
function proUpsellStrip(){if(!PAID_FEATURES_ENABLED||isPro())return'';return proCard({icon:PRO_LOCK_SVG,title:'See the next 7 days at a glance',sub:'Plan golden hour shoots and ideal flight windows days before you head out.',pills:['&#128197; 7-day Forecast','&#127749; Golden Hour','&#128506;&#65039; Sun Path Map','&#9728;&#65039; Sunrise/Sunset %','&#128247; Photo Conditions','&#128168; Wind Detail','&#9888;&#65039; Hazard Map','&#9992;&#65039; Flight Log']});}
function proAccountCard(){if(!isPro()||!proUser)return'';var initials=(proUser.name||proUser.email||'P').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();return'<div class="pro-account-card"><div class="pro-avatar">'+esc(initials)+'</div><div style="flex:1;min-width:0;"><div class="pro-account-name">'+esc(proUser.name||proUser.email||'Pro user')+'</div><div class="pro-account-badge">DroneChecker Pro</div></div><div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0;"><button class="pro-signout-btn" onclick="signOutPro()">Sign out</button><button class="pro-signout-btn" onclick="openBillingPortal()" style="font-size:10px;opacity:.7;">Manage subscription</button></div></div>';}

// ---- SETTINGS ----
function openSettings(){
  var overlay=document.getElementById('settings-overlay');
  if(overlay)overlay.classList.add('open');
  var darkToggle=document.getElementById('settings-dark-toggle');
  if(darkToggle)darkToggle.checked=!document.body.classList.contains('light-mode');
  var wu=document.getElementById('settings-wind-unit');
  if(wu)wu.value=unitMode;
  var tu=document.getElementById('settings-temp-unit');
  if(tu)tu.value=tempMode;
  var vEl=document.getElementById('settings-version');
  if(vEl)vEl.textContent='v'+APP_VERSION;
  var pro=isPro();
  var proStyle='background:#f59e0b;border-color:rgba(245,158,11,.3);color:#000;font-weight:700;font-size:11px;padding:5px 10px;';
  // Wind thresholds row
  var thrLabel=document.getElementById('settings-thr-label');
  var thrBtn=document.getElementById('settings-thr-btn');
  if(thrLabel)thrLabel.style.opacity=pro?'':'0.6';
  if(thrBtn){
    if(pro){thrBtn.textContent='Edit';thrBtn.style.cssText='';thrBtn.onclick=function(){closeSettings();openThresholdSheet();};}
    else{thrBtn.textContent='PRO';thrBtn.style.cssText=proStyle;thrBtn.onclick=openProOverlay;}
  }
  // Custom drone profiles row
  var cdLabel=document.getElementById('settings-cd-label');
  var cdBtn=document.getElementById('settings-cd-btn');
  if(cdLabel)cdLabel.style.opacity=pro?'':'0.6';
  if(cdBtn){
    if(pro){cdBtn.textContent='Manage';cdBtn.style.cssText='';cdBtn.onclick=function(){closeSettings();openCustomDroneOverlay();};}
    else{cdBtn.textContent='PRO';cdBtn.style.cssText=proStyle;cdBtn.onclick=openProOverlay;}
  }
  // Operator & Flyer ID row
  var didLabel=document.getElementById('settings-droneid-label');
  var didBtn=document.getElementById('settings-droneid-btn');
  if(didLabel)didLabel.style.opacity=pro?'':'0.6';
  if(didBtn){
    if(pro){didBtn.textContent='Configure';didBtn.style.cssText='';didBtn.onclick=function(){closeSettings();openDroneIdSheet();};}
    else{didBtn.textContent='PRO';didBtn.style.cssText=proStyle;didBtn.onclick=openProOverlay;}
  }
  if(pro)updateSettingsDroneIdRow();
  // Flight alerts row
  var alertLabel=document.getElementById('settings-alert-label');
  var alertBtn=document.getElementById('settings-alert-btn');
  if(alertLabel)alertLabel.style.opacity=pro?'':'0.6';
  if(alertBtn){
    if(pro){alertBtn.textContent='Configure';alertBtn.style.cssText='';alertBtn.onclick=function(){closeSettings();openAlertSheet();};}
    else{alertBtn.textContent='PRO';alertBtn.style.cssText=proStyle;alertBtn.onclick=openProOverlay;}
  }
  if(pro)updateSettingsAlertRow();
  // Account section — only shown when signed in (Pro or not)
  var signedIn=!!(proUser&&proUser.uid);
  var acctSection=document.getElementById('settings-account-section');
  var acctRow=document.getElementById('settings-account-row');
  var delRow=document.getElementById('settings-delete-row');
  if(acctSection)acctSection.style.display=signedIn?'':'none';
  if(acctRow)acctRow.style.display=signedIn?'':'none';
  if(delRow)delRow.style.display=signedIn?'':'none';
  var emailEl=document.getElementById('settings-account-email');
  if(emailEl)emailEl.textContent=signedIn?(proUser.email||''):'';
}
function closeSettings(){
  var overlay=document.getElementById('settings-overlay');
  if(overlay)overlay.classList.remove('open');
}
function closeSettingsOutside(e){
  if(e.target===document.getElementById('settings-overlay'))closeSettings();
}
function toggleTheme(isDark){
  if(isDark){document.body.classList.remove('light-mode');localStorage.setItem('dc_theme','dark');}
  else{document.body.classList.add('light-mode');localStorage.setItem('dc_theme','light');}
}
function saveWindUnit(val){
  // Map settings values to existing unitMode system
  unitMode=val==='mph'?'mph':val==='ms'?'ms':val==='kts'?'kts':'kmh';
  saveUnits();
  updateUnitToggle();
  updateDroneLimits();
  if(wxData){renderDash();renderFc();if(document.getElementById('tab-radar').classList.contains('on'))renderWindTab();}
}
function saveTempUnit(val){
  tempMode=val;
  saveUnits();
  if(wxData){renderDash();renderFc();}
}
function resetDataFromSettings(){
  if(confirm('Reset all app data? This will clear your settings, checklist progress and consent. Your flight log will not be deleted.')){
    closeSettings();
    var keys=['dc_drone','dc_units','dc_checklist','dc_disclaimer','dc_analytics_consent','dc_onboarded','dc_favs','dc_wx','dc_lastloc','dc_theme','dc_alerts'];
    keys.forEach(function(k){try{localStorage.removeItem(k);}catch(e){}});
    location.reload();
  }
}
function deleteAccountFromSettings(){
  if(!proUser||!proUser.uid){showToast('Please sign in first');return;}
  if(!confirm('Permanently delete your DroneChecker account?\n\nThis cancels any active subscription and erases your cloud data — flight log, alerts, saved locations and drone IDs. This cannot be undone.'))return;
  var btn=document.getElementById('settings-delete-btn');
  if(btn){btn.textContent='Deleting…';btn.disabled=true;}
  var reset=function(){if(btn){btn.textContent='Delete';btn.disabled=false;}};
  if(!_fbLoaded||!firebase.auth().currentUser){
    showToast('Authentication error. Please sign in again.');
    reset();return;
  }
  firebase.auth().currentUser.getIdToken().then(function(idToken){
    return fetch(DELETE_ACCOUNT_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+idToken},
      body:JSON.stringify({uid:proUser.uid})
    }).then(function(r){return r.json();}).then(function(data){
      if(data.deleted){
        saveProUser(null);
        try{localStorage.removeItem('dc_pro_user');}catch(e){}
        firebase.auth().signOut().catch(function(){});
        closeSettings();
        updateProUI();
        renderFavBar();
        showToast('Account deleted');
        if(wxData){renderDash();renderFc();}
      } else {
        showToast('Could not delete account. Please try again.');
        reset();
      }
    });
  }).catch(function(){
    showToast('Could not delete account. Check your connection.');
    reset();
  });
}

// ---- Flight alerts (up to MAX_ALERTS profiles per user) ----
var MAX_ALERTS=3;
function genAlertId(){return 'a'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function loadAlertsLocal(){try{return JSON.parse(localStorage.getItem('dc_alerts'))||[];}catch(e){return [];}}
function saveAlertsLocal(arr){try{localStorage.setItem('dc_alerts',JSON.stringify(arr));}catch(e){}}
// _alerts only gets populated by syncAlertSettingsFromCloud, which runs on a fresh sign-in —
// NOT on a normal returning-session page load. Every function that reads/writes _alerts must
// call this first so it falls back to the local cache instead of silently acting on [].
function getAlerts(){
  if(!_alerts||!_alerts.length){
    var cached=loadAlertsLocal();
    if(cached&&cached.length)_alerts=cached;
  }
  return _alerts;
}
function saveAlertsMasterEnabled(val){
  if(!proUser||!proUser.uid||!_fbLoaded)return;
  var db=firebase.firestore();
  db.collection('users').doc(proUser.uid).set({alertsEnabled:val},{merge:true}).catch(function(){});
}
function syncAlertSettingsFromCloud(uid,cb){
  if(!_fbLoaded||!uid){cb&&cb(null);return;}
  var db=firebase.firestore();
  db.collection('users').doc(uid).get().then(function(snap){
    if(snap.exists){
      var d=snap.data();
      if(d.alerts){
        _alerts=d.alerts;
        var needsBackfill=false;
        _alerts.forEach(function(a){
          if(!a.droneName){a.droneName=(DRONES[a.droneKey]||{}).name||'Your drone';needsBackfill=true;}
        });
        saveAlertsLocal(_alerts);
        if(needsBackfill)saveAlertsToCloud(_alerts);
      } else if(d.alertSettings){
        // One-time migration: legacy single `alertSettings` object -> `alerts` array + `alertState` map.
        var id=genAlertId();
        var migrated=Object.assign({},d.alertSettings,{id:id});
        delete migrated.fcmToken; // was duplicated onto the legacy object; lives only at doc root now
        if(!migrated.droneName)migrated.droneName=(DRONES[migrated.droneKey]||{}).name||'Your drone';
        var state={};
        if(d.alertLastRatingGood!==undefined)state.lastRatingGood=d.alertLastRatingGood;
        if(d.alertMorningLastSentAt!==undefined)state.morningLastSentAt=d.alertMorningLastSentAt;
        if(d.alertLastSentAt!==undefined)state.lastSentAt=d.alertLastSentAt;
        if(d.alertRepeatLastSentAt!==undefined)state.repeatLastSentAt=d.alertRepeatLastSentAt;
        _alerts=[migrated];saveAlertsLocal(_alerts);
        _alertsEnabled=!!d.alertSettings.enabled;
        var migrateWrite={
          alerts:_alerts,
          alertsEnabled:_alertsEnabled,
          alertSettings:firebase.firestore.FieldValue.delete(),
          alertLastRatingGood:firebase.firestore.FieldValue.delete(),
          alertMorningLastSentAt:firebase.firestore.FieldValue.delete(),
          alertLastSentAt:firebase.firestore.FieldValue.delete(),
          alertRepeatLastSentAt:firebase.firestore.FieldValue.delete(),
          alertLastCheckedAt:firebase.firestore.FieldValue.delete()
        };
        migrateWrite['alertState.'+id]=state;
        db.collection('users').doc(uid).set(migrateWrite,{merge:true}).catch(function(){});
      } else {
        _alerts=[];
      }
      if(d.alertsEnabled!==undefined)_alertsEnabled=d.alertsEnabled;
      if(d.fcmToken)_fcmToken=d.fcmToken;
      // If the cloud function silently disabled alerts (stale FCM token), notify the user
      if(d.alertAutoDisabled){
        setTimeout(function(){
          showToast('Push alerts were auto-disabled (notification token expired). Open Settings → Alerts to re-enable.');
        },2500);
        // Clear the flag so we don't show the message again
        db.collection('users').doc(uid).set({alertAutoDisabled:false},{merge:true}).catch(function(){});
      }
    }
    cb&&cb(_alerts);
  }).catch(function(){cb&&cb(null);});
}
function saveAlertsToCloud(arr){
  if(!proUser||!proUser.uid||!_fbLoaded)return;
  var db=firebase.firestore();
  db.collection('users').doc(proUser.uid).set({alerts:arr},{merge:true}).catch(function(){});
}
function saveFCMTokenToFirestore(token){
  if(!proUser||!proUser.uid||!_fbLoaded)return;
  var db=firebase.firestore();
  db.collection('users').doc(proUser.uid).set({fcmToken:token},{merge:true}).catch(function(){});
}

// ---- FCM token registration ----
function loadFCMAndGetToken(callback){
  if(_fcmToken){callback(null,_fcmToken);return;}
  if(!('PushManager' in window)||!('Notification' in window)){callback(new Error('not-supported'),null);return;}
  loadFirebase(function(){
    if(_fcmLoaded&&_fcmMessaging){
      _fcmMessaging.getToken({vapidKey:FCM_VAPID_KEY,serviceWorkerRegistration:_swReg||undefined}).then(function(t){_fcmToken=t;callback(null,t);}).catch(function(e){callback(e,null);});
      return;
    }
    var s=document.createElement('script');
    s.src='https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js';
    s.integrity='sha384-XtSlZdmg0Ad5zf0AX4W9TGdm+dGjaNK4KG3lNFjfgbnxkCEuT9ugWXkLExgQTJ+6';
    s.crossOrigin='anonymous';
    s.onload=function(){
      try{
        _fcmMessaging=firebase.messaging();
        _fcmLoaded=true;
        _fcmMessaging.getToken({vapidKey:FCM_VAPID_KEY,serviceWorkerRegistration:_swReg||undefined}).then(function(t){
          _fcmToken=t;callback(null,t);
        }).catch(function(e){callback(e,null);});
      }catch(e){callback(e,null);}
    };
    s.onerror=function(){callback(new Error('FCM load failed'),null);};
    document.head.appendChild(s);
  });
}

// ---- Alert sheet open/close ----
function openAlertSheet(){
  if(!isPro()){openProOverlay();return;}
  var overlay=document.getElementById('alert-sheet-overlay');
  if(!overlay)return;
  overlay.classList.add('open');
  populateAlertSheet();
}
function closeAlertSheet(){
  var overlay=document.getElementById('alert-sheet-overlay');
  if(overlay)overlay.classList.remove('open');
}

function populateAlertSheet(){
  var notifGranted=('Notification' in window)&&Notification.permission==='granted';
  var hasToken=!!_fcmToken;
  var isEnabled=!!(hasToken&&notifGranted&&_alertsEnabled!==false);
  var toggle=document.getElementById('alert-enabled-toggle');
  var statusSub=document.getElementById('alert-status-sub');
  var configSection=document.getElementById('alert-config-section');
  if(toggle)toggle.checked=isEnabled;
  if(statusSub){
    if(!('PushManager' in window)||!('Notification' in window))statusSub.textContent=(isIOS&&!isStandalone)?'Add to Home Screen first (iOS)':'Not supported on this browser';
    else if(Notification.permission==='denied')statusSub.textContent='Blocked — enable in browser/OS settings';
    else if(isEnabled)statusSub.textContent='Active';
    else statusSub.textContent='Off — toggle to enable';
  }
  if(configSection)configSection.style.display=isEnabled?'block':'none';
  closeAlertEditor();
  renderAlertList();
}

// ---- Alert list/editor views ----
function renderAlertList(){
  getAlerts();
  var body=document.getElementById('alert-list-body');
  var addBtn=document.getElementById('alert-add-btn');
  if(body){
    if(!_alerts.length){
      body.innerHTML='<div style="padding:8px 20px 4px;font-size:13px;color:var(--muted);">No alerts yet — add one below.</div>';
    } else {
      body.innerHTML=_alerts.map(function(a){
        var dayCount=(a.activeDays&&a.activeDays.length)?a.activeDays.length:7;
        var daysTxt=dayCount<7?(dayCount+' day'+(dayCount===1?'':'s')):'Every day';
        var droneName=a.droneName||(DRONES[a.droneKey]||{}).name||'Drone';
        var ws=a.windowStart!==undefined?a.windowStart:6;
        var we=a.windowEnd!==undefined?a.windowEnd:21;
        var summary=esc(daysTxt+' · '+pad(ws)+':00–'+pad(we)+':00 · '+droneName);
        return '<div class="settings-row">'+
            '<div style="min-width:0;flex:1;margin-right:8px;">'+
              '<div class="settings-row-label">'+esc(a.locationName||'Location')+'</div>'+
              '<div class="settings-row-sub">'+summary+'</div>'+
            '</div>'+
            '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">'+
              '<label class="settings-toggle">'+
                '<input type="checkbox" '+(a.enabled?'checked':'')+' onchange="toggleAlertEnabled(\''+a.id+'\')">'+
                '<span class="settings-toggle-slider"></span>'+
              '</label>'+
              '<button class="settings-btn" onclick="openAlertEditor(\''+a.id+'\')">Edit</button>'+
              '<button onclick="deleteAlert(\''+a.id+'\')" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;padding:0 2px;line-height:1;">×</button>'+
            '</div>'+
          '</div>';
      }).join('');
    }
  }
  if(addBtn){
    if(_alerts.length>=MAX_ALERTS){
      addBtn.textContent='Maximum reached ('+MAX_ALERTS+')';
      addBtn.disabled=true;
      addBtn.style.opacity='.5';
    } else {
      addBtn.textContent='+ Add alert';
      addBtn.disabled=false;
      addBtn.style.opacity='1';
    }
  }
  var listView=document.getElementById('alert-list-view');
  var editorView=document.getElementById('alert-editor-view');
  if(listView)listView.style.display='block';
  if(editorView)editorView.style.display='none';
}

function openAlertEditor(id){
  getAlerts();
  if(id===undefined)id=null;
  if(!id&&_alerts.length>=MAX_ALERTS){showToast('Maximum '+MAX_ALERTS+' alerts — delete one first');return;}
  _editingAlertId=id;
  var a=id?_alerts.find(function(x){return x.id===id;}):null;
  if(!a)a={windowStart:6,windowEnd:21,minRating:'green',activeDays:[0,1,2,3,4,5,6],droneKey:selectedDrone};
  populateAlertLocSelect(a);
  populateAlertTimeSelects(a);
  updateAlertWindowHint();
  populateAlertDays(a);
  populateAlertMorning(a);
  var rSel=document.getElementById('alert-rating-select');
  if(rSel)rSel.value=a.minRating||'green';
  var worsenToggle=document.getElementById('alert-worsen-toggle');
  if(worsenToggle)worsenToggle.checked=!!a.notifyOnClose;
  var repeatSel=document.getElementById('alert-repeat-select');
  if(repeatSel)repeatSel.value=String(a.repeatIntervalHours||0);
  var droneSel=document.getElementById('alert-drone-select');
  if(droneSel){
    var mainSel=document.getElementById('drone-sel');
    if(mainSel)droneSel.innerHTML=mainSel.innerHTML;
    droneSel.value=a.droneKey||selectedDrone;
  }
  var listView=document.getElementById('alert-list-view');
  var editorView=document.getElementById('alert-editor-view');
  if(listView)listView.style.display='none';
  if(editorView)editorView.style.display='block';
}

function closeAlertEditor(){
  _editingAlertId=null;
  var listView=document.getElementById('alert-list-view');
  var editorView=document.getElementById('alert-editor-view');
  if(listView)listView.style.display='block';
  if(editorView)editorView.style.display='none';
}

function toggleAlertEnabled(id){
  getAlerts();
  var a=_alerts.find(function(x){return x.id===id;});
  if(!a)return;
  a.enabled=!a.enabled;
  saveAlertsLocal(_alerts);saveAlertsToCloud(_alerts);
  renderAlertList();updateSettingsAlertRow();
}

function deleteAlert(id){
  getAlerts();
  if(!confirm('Delete this alert?'))return;
  _alerts=_alerts.filter(function(x){return x.id!==id;});
  saveAlertsLocal(_alerts);saveAlertsToCloud(_alerts);
  if(proUser&&proUser.uid&&_fbLoaded){
    var db=firebase.firestore();
    var clear={};
    clear['alertState.'+id]=firebase.firestore.FieldValue.delete();
    db.collection('users').doc(proUser.uid).set(clear,{merge:true}).catch(function(){});
  }
  renderAlertList();updateSettingsAlertRow();
}

function populateAlertLocSelect(s){
  var sel=document.getElementById('alert-loc-select');
  if(!sel)return;
  sel.innerHTML='';
  var curName=(document.getElementById('loc-name')||{}).textContent||'Current location';
  var cur=document.createElement('option');
  cur.value='current';cur.textContent=curName||'Current location';
  if(!s.locationName||s.locationName===curName)cur.selected=true;
  sel.appendChild(cur);
  loadFavs().forEach(function(f){
    var o=document.createElement('option');
    o.value=JSON.stringify({name:f.name,lat:f.lat,lng:f.lng});
    o.textContent=f.name;
    if(s.locationName===f.name)o.selected=true;
    sel.appendChild(o);
  });
}

function populateAlertTimeSelects(s){
  var fromSel=document.getElementById('alert-from-select');
  var toSel=document.getElementById('alert-to-select');
  if(!fromSel||!toSel)return;
  fromSel.innerHTML='';toSel.innerHTML='';
  for(var h=0;h<24;h++){
    var lbl=pad(h)+':00';
    var o1=document.createElement('option');o1.value=h;o1.textContent=lbl;
    if(h===(s.windowStart!==undefined?s.windowStart:6))o1.selected=true;
    fromSel.appendChild(o1);
    var o2=document.createElement('option');o2.value=h;o2.textContent=lbl;
    if(h===(s.windowEnd!==undefined?s.windowEnd:21))o2.selected=true;
    toSel.appendChild(o2);
  }
}
function updateAlertWindowHint(){
  var fromSel=document.getElementById('alert-from-select');
  var toSel=document.getElementById('alert-to-select');
  var hint=document.getElementById('alert-window-hint');
  if(!fromSel||!toSel||!hint)return;
  var from=parseInt(fromSel.value),to=parseInt(toSel.value);
  if(from===to){
    hint.style.display='block';
    hint.style.color='var(--red)';
    hint.textContent='From and Until are the same time — this window would never open.';
  } else if(from>to){
    hint.style.display='block';
    hint.style.color='var(--muted)';
    hint.textContent='Covers overnight: '+pad(from)+':00 → '+pad(to)+':00 the next day.';
  } else {
    hint.style.display='none';
  }
}

function populateAlertDays(s){
  var row=document.getElementById('alert-days-row');
  if(!row)return;
  var days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var active=s.activeDays||(s.activeDays===undefined?[0,1,2,3,4,5,6]:s.activeDays);
  if(!active||!active.length)active=[0,1,2,3,4,5,6];
  row.innerHTML='';
  days.forEach(function(d,i){
    var btn=document.createElement('button');
    btn.className='alert-day-chip'+(active.indexOf(i)!==-1?' active':'');
    btn.textContent=d;
    btn.onclick=function(){
      btn.classList.toggle('active');
    };
    row.appendChild(btn);
  });
}

function populateAlertMorning(s){
  var toggle=document.getElementById('alert-morning-toggle');
  var timeRow=document.getElementById('alert-morning-time-row');
  var hourSel=document.getElementById('alert-morning-hour-select');
  if(!toggle||!timeRow||!hourSel)return;
  toggle.checked=!!s.morningForecastEnabled;
  timeRow.style.display=s.morningForecastEnabled?'flex':'none';
  hourSel.innerHTML='';
  for(var h=4;h<=11;h++){
    var o=document.createElement('option');
    o.value=h;o.textContent=pad(h)+':00';
    if(h===(s.morningForecastHour!==undefined?s.morningForecastHour:7))o.selected=true;
    hourSel.appendChild(o);
  }
}

function onAlertToggleChange(checked){
  if(checked){
    if(!('PushManager' in window)||!('Notification' in window)){
      if(isIOS&&!isStandalone){
        showToast('Add DroneChecker to your Home Screen first (Share → Add to Home Screen) — notifications only work in the installed app on iPhone',6000);
      } else {
        showToast('Push notifications not supported on this browser');
      }
      var t=document.getElementById('alert-enabled-toggle');if(t)t.checked=false;return;
    }
    if(Notification.permission==='denied'){
      showToast('Notifications are blocked — enable in your browser or OS settings');
      var t=document.getElementById('alert-enabled-toggle');if(t)t.checked=false;return;
    }
    Notification.requestPermission().then(function(perm){
      if(perm!=='granted'){
        showToast('Notification permission denied');
        var t=document.getElementById('alert-enabled-toggle');if(t)t.checked=false;return;
      }
      if(FCM_VAPID_KEY==='REPLACE_WITH_VAPID_KEY_FROM_FIREBASE_CONSOLE'){
        showToast('VAPID key not configured yet — set FCM_VAPID_KEY in app.html');
        var t=document.getElementById('alert-enabled-toggle');if(t)t.checked=false;return;
      }
      loadFCMAndGetToken(function(err,token){
        if(err||!token){
          var msg=err?(err.code||err.message||String(err)):'no token returned';
          var friendlyMsg=msg.indexOf('permission-blocked')!==-1
            ?'Notifications unavailable — set Chrome or Samsung Internet as your default browser and try again'
            :'Could not enable notifications ('+msg+')';
          showToast(friendlyMsg,6000);
          console.error('[DC] FCM token error:',err);
          var t=document.getElementById('alert-enabled-toggle');if(t)t.checked=false;return;
        }
        _fcmToken=token;
        _alertsEnabled=true;
        saveFCMTokenToFirestore(token);
        saveAlertsMasterEnabled(true);
        var cfg=document.getElementById('alert-config-section');if(cfg)cfg.style.display='block';
        var sub=document.getElementById('alert-status-sub');if(sub)sub.textContent='Active';
        renderAlertList();
      });
    });
  } else {
    var cfg=document.getElementById('alert-config-section');if(cfg)cfg.style.display='none';
    var sub=document.getElementById('alert-status-sub');if(sub)sub.textContent='Off — toggle to enable';
    _alertsEnabled=false;
    saveAlertsMasterEnabled(false);
  }
}

function saveAlertFromEditor(){
  getAlerts();
  if(!_fcmToken){showToast('Please enable alerts first');return;}
  var locSel=document.getElementById('alert-loc-select');
  var fromSel=document.getElementById('alert-from-select');
  var toSel=document.getElementById('alert-to-select');
  var ratSel=document.getElementById('alert-rating-select');
  var droneSel=document.getElementById('alert-drone-select');
  var locVal=locSel?locSel.value:'current';
  var lat,lng,locationName;
  if(locVal==='current'){
    lat=uLat;lng=uLng;
    locationName=(document.getElementById('loc-name')||{}).textContent||'Current';
  } else {
    try{var p=JSON.parse(locVal);lat=p.lat;lng=p.lng;locationName=p.name;}
    catch(e){lat=uLat;lng=uLng;locationName='Current';}
  }
  if(!lat||!lng){showToast('No location available — search for a location first');return;}
  var windowStart=parseInt(fromSel?fromSel.value:6);
  var windowEnd=parseInt(toSel?toSel.value:21);
  if(windowStart===windowEnd){showToast('From and Until can\'t be the same time — that window would never open');return;}
  var activeDays=[];
  var chips=document.querySelectorAll('#alert-days-row .alert-day-chip');
  chips.forEach(function(c,i){if(c.classList.contains('active'))activeDays.push(i);});
  if(!activeDays.length)activeDays=[0,1,2,3,4,5,6];
  var worsenToggle=document.getElementById('alert-worsen-toggle');
  var repeatSel=document.getElementById('alert-repeat-select');
  var morningToggle=document.getElementById('alert-morning-toggle');
  var morningHourSel=document.getElementById('alert-morning-hour-select');
  var isNew=!_editingAlertId;
  if(isNew&&_alerts.length>=MAX_ALERTS){showToast('Maximum '+MAX_ALERTS+' alerts — delete one first');return;}
  var a={
    id:_editingAlertId||genAlertId(),
    enabled:true,
    locationName:locationName,
    lat:lat,lng:lng,
    droneKey:droneSel?droneSel.value:selectedDrone,
    droneName:droneSel&&droneSel.selectedIndex>-1?droneSel.options[droneSel.selectedIndex].text:getDrone().name,
    windowStart:windowStart,
    windowEnd:windowEnd,
    minRating:ratSel?ratSel.value:'green',
    activeDays:activeDays,
    notifyOnClose:!!(worsenToggle&&worsenToggle.checked),
    repeatIntervalHours:parseInt(repeatSel?repeatSel.value:0),
    morningForecastEnabled:!!(morningToggle&&morningToggle.checked),
    morningForecastHour:parseInt(morningHourSel?morningHourSel.value:7),
    utcOffsetMinutes:-new Date().getTimezoneOffset()
  };
  if(isNew){
    _alerts.push(a);
  } else {
    _alerts=_alerts.map(function(x){return x.id===_editingAlertId?a:x;});
  }
  saveAlertsLocal(_alerts);
  saveAlertsToCloud(_alerts);
  showToast('Alert saved — you\'ll be notified when conditions open up');
  closeAlertEditor();
  renderAlertList();
  updateSettingsAlertRow();
}

// ---- Operator & Flyer ID ----
function loadDroneIdsLocal(){try{return JSON.parse(localStorage.getItem('dc_drone_ids'))||null;}catch(e){return null;}}
function saveDroneIdsLocal(d){try{localStorage.setItem('dc_drone_ids',JSON.stringify(d));}catch(e){}}
function syncDroneIdsFromCloud(uid,cb){
  if(!_fbLoaded||!uid){cb&&cb(null);return;}
  var db=firebase.firestore();
  db.collection('users').doc(uid).get().then(function(snap){
    if(snap.exists){
      var d=snap.data();
      if(d.droneIds){_droneIds=d.droneIds;saveDroneIdsLocal(_droneIds);}
    }
    cb&&cb(_droneIds);
  }).catch(function(){cb&&cb(null);});
}
function saveDroneIdsToCloud(ids){
  if(!proUser||!proUser.uid||!_fbLoaded)return;
  var db=firebase.firestore();
  db.collection('users').doc(proUser.uid).set({droneIds:ids},{merge:true}).catch(function(){});
}

function openDroneIdSheet(){
  if(!isPro()){openProOverlay();return;}
  if(proUser&&proUser.uid)syncDroneIdsFromCloud(proUser.uid,null);
  var overlay=document.getElementById('droneid-sheet-overlay');
  if(!overlay)return;
  overlay.classList.add('open');
  populateDroneIdSheet();
}
function closeDroneIdSheet(){
  var overlay=document.getElementById('droneid-sheet-overlay');
  if(overlay)overlay.classList.remove('open');
}
function populateDroneIdSheet(){
  var d=_droneIds||loadDroneIdsLocal()||{};
  var opId=document.getElementById('droneid-operator-id');if(opId)opId.value=d.operatorId||'';
  var opExp=document.getElementById('droneid-operator-expiry');if(opExp)opExp.value=d.operatorIdExpiry||'';
  var opRem=document.getElementById('droneid-operator-reminder');if(opRem)opRem.value=String(d.operatorReminderDays||14);
  var flId=document.getElementById('droneid-flyer-id');if(flId)flId.value=d.flyerId||'';
  var flExp=document.getElementById('droneid-flyer-expiry');if(flExp)flExp.value=d.flyerIdExpiry||'';
  var flRem=document.getElementById('droneid-flyer-reminder');if(flRem)flRem.value=String(d.flyerReminderDays||14);
}
function saveDroneIdsFromSheet(){
  var ids={
    operatorId:(document.getElementById('droneid-operator-id')||{}).value.trim(),
    operatorIdExpiry:(document.getElementById('droneid-operator-expiry')||{}).value,
    operatorReminderDays:parseInt((document.getElementById('droneid-operator-reminder')||{}).value||14,10),
    flyerId:(document.getElementById('droneid-flyer-id')||{}).value.trim(),
    flyerIdExpiry:(document.getElementById('droneid-flyer-expiry')||{}).value,
    flyerReminderDays:parseInt((document.getElementById('droneid-flyer-reminder')||{}).value||14,10)
  };
  _droneIds=ids;
  saveDroneIdsLocal(ids);
  saveDroneIdsToCloud(ids);
  showToast('Saved — we\'ll remind you before each renewal');
  closeDroneIdSheet();
  updateSettingsDroneIdRow();
  _lastDashSig=null;
  if(wxData)renderDash();
}
function updateSettingsDroneIdRow(){
  var subEl=document.getElementById('settings-droneid-sub');
  if(!subEl)return;
  var d=_droneIds||loadDroneIdsLocal();
  var n=d?((d.operatorId?1:0)+(d.flyerId?1:0)):0;
  subEl.textContent=n===2?'Both IDs saved':n===1?'1 of 2 IDs saved':'Add your IDs for renewal reminders';
}
function renderIdReminderBanner(){
  if(!isPro())return'';
  var d=_droneIds||loadDroneIdsLocal();
  if(!d)return'';
  var todayUTC=Date.UTC(new Date().getFullYear(),new Date().getMonth(),new Date().getDate());
  function daysUntil(dateStr){
    var p=dateStr.split('-');
    return Math.round((Date.UTC(+p[0],+p[1]-1,+p[2])-todayUTC)/86400000);
  }
  var checks=[
    {label:'Operator ID',expiry:d.operatorIdExpiry,days:d.operatorReminderDays||14,verb:'renews'},
    {label:'Flyer ID',expiry:d.flyerIdExpiry,days:d.flyerReminderDays||14,verb:'expires'}
  ];
  var due=[];
  checks.forEach(function(c){
    if(!c.expiry)return;
    var remaining=daysUntil(c.expiry);
    if(remaining<=c.days)due.push({label:c.label,remaining:remaining,verb:c.verb});
  });
  if(!due.length)return'';
  due.sort(function(a,b){return a.remaining-b.remaining;});
  var first=due[0];
  var txt;
  if(first.remaining<0)txt=first.label+' '+(first.verb==='renews'?'renewal':'expiry')+' was '+Math.abs(first.remaining)+' day'+(Math.abs(first.remaining)===1?'':'s')+' ago';
  else if(first.remaining===0)txt=first.label+' '+first.verb+' today';
  else txt=first.label+' '+first.verb+' in '+first.remaining+' day'+(first.remaining===1?'':'s');
  if(due.length>1)txt+=' (+'+(due.length-1)+' more)';
  return '<div class="card" style="cursor:pointer;display:flex;align-items:flex-start;gap:9px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);" onclick="openDroneIdSheet()">'+
    '<span style="font-size:14px;flex-shrink:0;">⚠</span>'+
    '<div style="flex:1;"><div style="font-size:13px;font-weight:600;color:#f59e0b;">'+esc(txt)+'</div><div style="font-size:11px;color:#f59e0b;opacity:.85;margin-top:1px;">Tap to update your IDs</div></div>'+
    '</div>';
}

function updateSettingsAlertRow(){
  var subEl=document.getElementById('settings-alert-sub');
  if(!subEl)return;
  var alerts=_alerts&&_alerts.length?_alerts:loadAlertsLocal();
  var n=alerts?alerts.filter(function(a){return a.enabled;}).length:0;
  subEl.textContent=n?(n+' alert'+(n!==1?'s':'')+' active'):'Off';
}

// Apply saved theme on load (default: dark)
(function(){if(localStorage.getItem('dc_theme')==='light')document.body.classList.add('light-mode');})();

function openBillingPortal(){
  if(!proUser||!proUser.uid){showToast('Please sign in first');return;}
  var btn=event&&event.target;
  if(btn){btn.textContent='Loading…';btn.disabled=true;}
  var reset=function(){if(btn){btn.textContent='Manage subscription';btn.disabled=false;}};
  if(!_fbLoaded||!firebase.auth().currentUser){
    showToast('Authentication error. Please sign in again.');
    reset();return;
  }
  firebase.auth().currentUser.getIdToken().then(function(idToken){
    return fetch('https://us-central1-dronechecker.cloudfunctions.net/createPortalSession',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+idToken},
      body:JSON.stringify({uid:proUser.uid})
    }).then(function(r){return r.json();}).then(function(data){
      if(data.url&&isStripeUrl(data.url)){window.location.href=data.url;}
      else{showToast('Could not open billing portal. Please try again.');reset();}
    });
  }).catch(function(){
    showToast('Could not open billing portal. Check your connection.');
    reset();
  });
}
function getMaxFavs(){return isPro()?999:2;}
function proGateExport(){if(!isPro()){showToast('Export is a Pro feature');openProOverlay();return false;}return true;}
function getWindowHours(){return isPro()?72:6;}
// ---- Pro: multiple custom drone profiles ----
var customDrone={name:'My Custom Drone',windAmber:22,windRed:31,gustAmber:25,gustRed:31};
var customDrones=[];

function loadCustomDrone(){
  try{
    // Migrate legacy single drone
    var legacy=localStorage.getItem('dc_custom_drone');
    var multi=localStorage.getItem('dc_custom_drones');
    if(multi){
      customDrones=JSON.parse(multi);
    } else if(legacy){
      customDrones=[JSON.parse(legacy)];
      localStorage.setItem('dc_custom_drones',JSON.stringify(customDrones));
    }
    // Sync DRONES object with all custom drones
    customDrones.forEach(function(d,i){DRONES['custom_'+i]=d;});
    // Backward compat: set customDrone to first
    if(customDrones.length)customDrone=customDrones[0];
  }catch(e){customDrones=[];}
}

function saveCustomDrones(){
  try{localStorage.setItem('dc_custom_drones',JSON.stringify(customDrones));}catch(e){}
}

function saveCustomDrone(d){customDrone=d;try{localStorage.setItem('dc_custom_drone',JSON.stringify(d));}catch(e){}}

function rebuildCustomDroneOptions(){
  var sel=document.getElementById('drone-sel');
  if(!sel)return;
  // Remove existing custom optgroup
  var existing=document.getElementById('drone-custom-group');
  if(existing)existing.remove();
  var teaser=document.getElementById('drone-pro-teaser-group');
  if(!isPro()){
    if(!teaser){
      var tg=document.createElement('optgroup');tg.label='Pro';tg.id='drone-pro-teaser-group';
      var to=document.createElement('option');to.value='__pro__';to.textContent='Custom Drone (Pro only)';
      tg.appendChild(to);sel.appendChild(tg);
    }
    return;
  }
  if(teaser)teaser.remove();
  var grp=document.createElement('optgroup');
  grp.label='My Drones';grp.id='drone-custom-group';
  customDrones.forEach(function(d,i){
    var opt=document.createElement('option');
    opt.value='custom_'+i;
    opt.textContent=d.name;
    grp.appendChild(opt);
  });
  sel.appendChild(grp);
  // Restore selected value
  if(selectedDrone&&selectedDrone.indexOf('custom_')===0){
    sel.value=selectedDrone;
    // If that option no longer exists, reset
    if(sel.value!==selectedDrone){selectedDrone='mini4pro';sel.value=selectedDrone;try{localStorage.setItem('dc_drone',selectedDrone);}catch(e){}}
  }
}

function openCustomDroneEditor(editIdx){
  if(!isPro()){openProOverlay();return;}
  var isEdit=typeof editIdx==='number';
  var d=isEdit?customDrones[editIdx]:{name:'',windAmber:22,windRed:31,gustAmber:25,gustRed:31};
  var overlay=document.createElement('div');
  overlay.id='custom-drone-overlay';
  overlay.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.85);z-index:10002;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
  var deleteBtn=isEdit?'<button onclick="deleteCustomDrone('+editIdx+')" style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);border-radius:var(--radius-sm);padding:8px 12px;color:var(--red);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;flex:1;">Delete</button>':'';
  overlay.innerHTML='<div style="background:var(--bg2);border-radius:16px;padding:24px 20px;width:100%;max-width:380px;border:1px solid var(--border);">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">'+
    '<div style="font-size:15px;font-weight:700;">'+(isEdit?'Edit Drone Profile':'Add Custom Drone')+'</div>'+
    '<button onclick="var ov=document.getElementById(\'custom-drone-overlay\');if(ov)ov.remove();if(_cDroneFromList){_cDroneFromList=false;openCustomDroneOverlay();}" style="background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer;">&times;</button></div>'+
    '<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Drone name</div>'+
    '<input id="cd-name" class="log-input" value="'+esc(d.name)+'" placeholder="e.g. DJI Avata 2" style="margin-bottom:12px;"/>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">'+
    '<div><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Wind caution (km/h)</div><input id="cd-wa" class="log-input" type="number" value="'+d.windAmber+'" style="margin-bottom:0;"/></div>'+
    '<div><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Wind avoid (km/h)</div><input id="cd-wr" class="log-input" type="number" value="'+d.windRed+'" style="margin-bottom:0;"/></div>'+
    '<div><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Gust caution (km/h)</div><input id="cd-ga" class="log-input" type="number" value="'+d.gustAmber+'" style="margin-bottom:0;"/></div>'+
    '<div><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Gust avoid (km/h)</div><input id="cd-gr" class="log-input" type="number" value="'+d.gustRed+'" style="margin-bottom:0;"/></div></div>'+
    '<div style="font-size:11px;color:var(--muted);margin-bottom:14px;line-height:1.5;">Values in km/h regardless of display unit.</div>'+
    '<div style="display:flex;gap:8px;">'+deleteBtn+'<button onclick="applyCustomDrone('+(isEdit?editIdx:'')+')" class="log-btn" style="flex:2;">Save</button></div>'+
    '</div>';
  document.body.appendChild(overlay);
}

function applyCustomDrone(editIdx){
  var name=document.getElementById('cd-name').value.trim()||'My Drone';
  var wa=parseInt(document.getElementById('cd-wa').value)||22;
  var wr=parseInt(document.getElementById('cd-wr').value)||31;
  var ga=parseInt(document.getElementById('cd-ga').value)||25;
  var gr=parseInt(document.getElementById('cd-gr').value)||31;
  if(wa>=wr)wr=wa+5;
  if(ga>=gr)gr=ga+5;
  var d={name:name,windAmber:wa,windRed:wr,gustAmber:ga,gustRed:gr};
  var isEdit=typeof editIdx==='number';
  if(isEdit){
    customDrones[editIdx]=d;
    DRONES['custom_'+editIdx]=d;
  } else {
    customDrones.push(d);
    var newIdx=customDrones.length-1;
    DRONES['custom_'+newIdx]=d;
    selectedDrone='custom_'+newIdx;
    try{localStorage.setItem('dc_drone',selectedDrone);}catch(e){}
  }
  saveCustomDrones();
  rebuildCustomDroneOptions();
  var sel=document.getElementById('drone-sel');
  if(sel&&!isEdit)sel.value=selectedDrone;
  updateDroneLimits();
  if(wxData){renderDash();renderFc();}
  renderFavBar();
  var ov=document.getElementById('custom-drone-overlay');if(ov)ov.remove();
  showToast(isEdit?name+' updated':name+' added to your fleet');
  if(_cDroneFromList){_cDroneFromList=false;openCustomDroneOverlay();}
}

function deleteCustomDrone(idx){
  if(!confirm('Delete '+customDrones[idx].name+'?'))return;
  customDrones.splice(idx,1);
  delete DRONES['custom_'+idx];
  // Re-index remaining custom drones
  customDrones.forEach(function(d,i){DRONES['custom_'+i]=d;});
  saveCustomDrones();
  // If currently selected drone was deleted, switch to first preset
  if(selectedDrone==='custom_'+idx||parseInt(selectedDrone.replace('custom_',''))>=customDrones.length){
    selectedDrone='mini4pro';
    try{localStorage.setItem('dc_drone',selectedDrone);}catch(e){}
  }
  rebuildCustomDroneOptions();
  var sel=document.getElementById('drone-sel');if(sel)sel.value=selectedDrone;
  updateDroneLimits();
  if(wxData){renderDash();renderFc();}
  renderFavBar();
  var ov=document.getElementById('custom-drone-overlay');if(ov)ov.remove();
  showToast('Drone removed');
  if(_cDroneFromList){_cDroneFromList=false;openCustomDroneOverlay();}
}

var _cDroneFromList=false;

function openCustomDroneOverlay(){
  if(!isPro()){openProOverlay();return;}
  var existing=document.getElementById('cd-list-overlay');if(existing)existing.remove();
  var overlay=document.createElement('div');
  overlay.id='cd-list-overlay';
  overlay.className='settings-overlay open';
  overlay.addEventListener('click',function(e){if(e.target===overlay)overlay.remove();});
  function render(){
    var rows='';
    if(!customDrones.length){
      rows='<div style="padding:20px 20px 8px;font-size:13px;color:var(--muted);text-align:center;">No custom drones yet.</div>';
    } else {
      customDrones.forEach(function(d,i){
        rows+='<div class="settings-row">'+
          '<div>'+
          '<div class="settings-row-label">'+esc(d.name)+'</div>'+
          '<div class="settings-row-sub">Wind caution '+d.windAmber+' · avoid '+d.windRed+' km/h</div>'+
          '</div>'+
          '<button class="settings-btn" onclick="openCDEditorFromList('+i+')">Edit</button>'+
          '</div>';
      });
    }
    overlay.innerHTML='<div class="settings-sheet">'+
      '<div class="settings-header">'+
      '<div class="settings-title">My Drone Profiles</div>'+
      '<button class="settings-close" onclick="document.getElementById(\'cd-list-overlay\').remove()">&times;</button>'+
      '</div>'+
      '<div class="settings-body">'+
      rows+
      '<div style="padding:16px 20px 4px;">'+
      '<button onclick="openCDEditorFromList()" style="width:100%;background:var(--accent);border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:700;color:#000;cursor:pointer;font-family:inherit;">+ Add custom drone</button>'+
      '</div></div></div>';
  }
  render();
  document.body.appendChild(overlay);
}

function openCDEditorFromList(editIdx){
  var list=document.getElementById('cd-list-overlay');if(list)list.remove();
  _cDroneFromList=true;
  openCustomDroneEditor(editIdx);
}

function initCustomDroneUI(){
  if(!PAID_FEATURES_ENABLED)return;
  loadCustomDrone();
  rebuildCustomDroneOptions();
  var bar=document.querySelector('.drone-bar');
  var existingBtn=document.getElementById('custom-drone-btn');
  if(isPro()){
    if(bar&&!existingBtn){
      var btn=document.createElement('button');
      btn.id='custom-drone-btn';
      btn.textContent='+ Drone';
      btn.style.cssText='background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:var(--radius-sm);padding:7px 8px;color:#f59e0b;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;';
      btn.onclick=function(){openCustomDroneEditor();};
      bar.appendChild(btn);
    }
  } else {
    if(existingBtn)existingBtn.remove();
  }
}
function proFavNudge(favs){if(!PAID_FEATURES_ENABLED)return'';if(!isPro()&&favs.length>=2){return'<button class="fav-add" onclick="openProOverlay()" style="border-color:rgba(245,158,11,.4);color:#f59e0b;">+ More spots</button>';}if(isPro()){return'<button class="fav-add" onclick="toggleFavCurrent()">+ Add</button>';}return'';}
function exportFlights(){exportXlsx();}
function renderBestTimeCard(){if(!wxData||!wxData.hourly)return'';if(!isPro()){return proCard({id:'best-time-card',icon:PRO_LOCK_SVG,title:'Today\'s Conditions Summary',sub:'Plain-English daily briefing — windows, wind trends, rain &amp; golden hour in one read.',pills:['🌬️ Wind trends','🌧️ Rain timing','🌅 Golden hour','✈️ Best windows','🔋 Battery &amp; temp']});}var hours=wxData.hourly,now=new Date(),today=now.toDateString();var todayHours=[],greenCount=0,amberCount=0;var sun=uLat&&uLng?calcSunTimes(uLat,uLng,now):null;for(var i=0;i<hours.time.length;i++){var t=new Date(hours.time[i]);if(t.toDateString()!==today||t<=now)continue;var w=hours.wind_speed_10m[i]||0,g=hours.wind_gusts_10m?hours.wind_gusts_10m[i]||0:0;var v=hours.visibility?hours.visibility[i]||10000:10000;var wmo=hours.weather_code?hours.weather_code[i]||0:0;var tp=hours.temperature_2m?hours.temperature_2m[i]||15:15;var w80=hours.wind_speed_80m?hours.wind_speed_80m[i]||0:0;var w120=hours.wind_speed_120m?hours.wind_speed_120m[i]||0:0;var precip=hours.precipitation_probability?Math.round(hours.precipitation_probability[i]||0):0;var r=flyRating(w,g,v,precipAdjustWmo(wmo,precip),getKpForTime(t),tp,w80,w120);var isGolden=sun&&((sun.goldMornS&&sun.goldMornE&&t>=sun.goldMornS&&t<=sun.goldMornE)||(sun.goldEveS&&sun.goldEveE&&t>=sun.goldEveS&&t<=sun.goldEveE));if(r.lvl==='green')greenCount++;else if(r.lvl==='amber')amberCount++;todayHours.push({t:t,rating:r.lvl,wind:w,gust:g,temp:tp,precip:precip,wmo:wmo,vis:v,isGolden:isGolden});}if(!todayHours.length)return'';var total=todayHours.length;var verdictLine,verdictCol;var fewHoursLeft=total<=3;if(greenCount>=Math.floor(total*.6)){verdictLine=fewHoursLeft?'Remaining conditions look good to fly.':'Most of the day looks good to fly.';verdictCol='var(--green)';}else if(greenCount+amberCount>=Math.floor(total*.5)){verdictLine=fewHoursLeft?'Mixed conditions for the rest of today.':'Mixed conditions today — some good windows available.';verdictCol='var(--amber)';}else{verdictLine=fewHoursLeft?'Conditions are challenging for the rest of today.':'Challenging conditions for most of today.';verdictCol='var(--red)';}var rainHours=todayHours.filter(function(h){return h.precip>=30;});var rainSentence='';if(rainHours.length){var rainStart=rainHours[0].t;var minPrecip=rainHours.reduce(function(m,h){return Math.min(m,h.precip);},100);var maxPrecip=rainHours.reduce(function(m,h){return Math.max(m,h.precip);},0);var precipStr=minPrecip===maxPrecip?minPrecip+'%':minPrecip+'–'+maxPrecip+'%';var clearAfter=null;var rainEndIdx=todayHours.indexOf(rainHours[rainHours.length-1]);for(var ri=rainEndIdx+1;ri<todayHours.length;ri++){if(todayHours[ri].precip<30){clearAfter=todayHours[ri].t;break;}}if(rainStart.getTime()===todayHours[0].t.getTime()){rainSentence=clearAfter?'Rain likely until around '+pad(clearAfter.getHours())+':00 ('+precipStr+' chance), then clearing.':'Rain expected for most of the remaining day ('+precipStr+' chance)';}else{rainSentence='Rain moves in around '+pad(rainStart.getHours())+':00 ('+precipStr+' chance)'+(clearAfter?' before clearing around '+pad(clearAfter.getHours())+':00.':'.');}}var peakGustHour=todayHours.reduce(function(a,b){return b.gust>a.gust?b:a;});var firstThird=todayHours.slice(0,Math.ceil(total/3));var lastThird=todayHours.slice(Math.floor(total*2/3));var avgFirst=firstThird.reduce(function(s,h){return s+h.wind;},0)/(firstThird.length||1);var avgLast=lastThird.reduce(function(s,h){return s+h.wind;},0)/(lastThird.length||1);var windDelta=avgLast-avgFirst;var thr=getThresholds();var windSentence='';if(total>=1){var wMin=Math.round(Math.min.apply(null,todayHours.map(function(h){return h.wind;})));var wMax=Math.round(Math.max.apply(null,todayHours.map(function(h){return h.wind;})));var gustMax=Math.round(peakGustHour.gust);var gustNote=gustMax>thr.gustAmber?', with gusts peaking at '+spd(gustMax)+' '+spdU()+' around '+pad(peakGustHour.t.getHours())+':00':'';if(windDelta>4){windSentence='Wind starts at '+spd(Math.round(avgFirst))+' '+spdU()+' but builds to around '+spd(Math.round(avgLast))+' '+spdU()+' later'+gustNote+'.';}else if(windDelta<-4){windSentence='Wind eases through the day from '+spd(Math.round(avgFirst))+' down to '+spd(Math.round(avgLast))+' '+spdU()+gustNote+'.';}else{var rangeStr=wMin===wMax?spd(wMin)+' '+spdU():spd(wMin)+'–'+spd(wMax)+' '+spdU();windSentence='Wind is fairly steady at '+rangeStr+gustNote+'.';}}var bestWindowSentence='';var greenRuns=[],curRun=[];for(var bi=0;bi<todayHours.length;bi++){if(todayHours[bi].rating==='green'){curRun.push(todayHours[bi]);}else{if(curRun.length){greenRuns.push(curRun);curRun=[];}}}if(curRun.length)greenRuns.push(curRun);if(greenRuns.length&&greenCount>0&&greenCount<total){var longest=greenRuns.reduce(function(a,b){return b.length>a.length?b:a;});if(longest.length>=2){bestWindowSentence='Best window is '+pad(longest[0].t.getHours())+':00–'+pad((longest[longest.length-1].t.getHours()+1)%24)+':00 ('+longest.length+'h of good conditions).';}else if(longest.length===1){bestWindowSentence='Only a single good hour at '+pad(longest[0].t.getHours())+':00 — plan accordingly.';}}var minTemp=todayHours.reduce(function(a,b){return b.temp<a.temp?b:a;}).temp;var tempSentence='';if(minTemp<5)tempSentence='Temperatures drop to '+tmp(Math.round(minTemp))+tmpU()+' — expect noticeably reduced battery life.';else if(minTemp<10)tempSentence='Cool temperatures around '+tmp(Math.round(minTemp))+tmpU()+' may reduce battery performance slightly.';var minVis=todayHours.reduce(function(a,b){return b.vis<a.vis?b:a;}).vis;var visSentence='';if(minVis<1000)visSentence='Visibility drops below 1 km at some point — check conditions before flying.';else if(minVis<5000)visSentence='Visibility is reduced at times — maintain visual line of sight carefully.';var goldenHoursArr=todayHours.filter(function(h){return h.isGolden;});var bestGolden=goldenHoursArr.length?goldenHoursArr[0]:null;var goldenSentence='';if(bestGolden&&bestGolden.rating==='green')goldenSentence='Golden hour around '+pad(bestGolden.t.getHours())+':00 looks flyable — ideal for photography.';else if(bestGolden&&bestGolden.rating==='amber')goldenSentence='Golden hour around '+pad(bestGolden.t.getHours())+':00 is marginal but may be worth attempting.';var parts=[];if(rainSentence)parts.push(rainSentence);if(windSentence)parts.push(windSentence);if(bestWindowSentence)parts.push(bestWindowSentence);if(goldenSentence)parts.push(goldenSentence);if(tempSentence)parts.push(tempSentence);if(visSentence)parts.push(visSentence);var narrative=parts.join(' ');return'<div class="card" id="best-time-card" style="border-color:rgba(245,158,11,.25);background:rgba(245,158,11,.04);"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;"><h2 class="card-ttl" style="margin-bottom:0;">Today\'s conditions summary</h2><span style="font-size:9px;font-weight:700;color:#f59e0b;background:rgba(245,158,11,.12);border-radius:3px;padding:1px 5px;">PRO</span></div><div style="font-size:16px;font-weight:700;color:'+verdictCol+';margin-bottom:8px;">'+verdictLine+'</div><div style="font-size:12px;color:var(--muted);line-height:1.8;">'+narrative+'</div></div>';}
function renderFlightStats(flights){if(!isPro()||flights.length<3)return'';var now=new Date(),months=[];for(var m=5;m>=0;m--){var d=new Date(now.getFullYear(),now.getMonth()-m,1);var label=d.toLocaleDateString('en-GB',{month:'short'});var mf=flights.filter(function(f){var fd=new Date(f.date);return fd.getMonth()===d.getMonth()&&fd.getFullYear()===d.getFullYear();});months.push({label:label,count:mf.length});}var maxCount=Math.max.apply(null,months.map(function(m){return m.count;}));if(maxCount===0)return'';var locMap={};flights.forEach(function(f){if(f.loc)locMap[f.loc]=(locMap[f.loc]||0)+1;});var topLocs=Object.keys(locMap).sort(function(a,b){return locMap[b]-locMap[a];}).slice(0,3);var good=flights.filter(function(f){return f.cond==='Good to Fly';}).length;var caution=flights.filter(function(f){return f.cond==='Fly with Caution';}).length;var avoid=flights.filter(function(f){return f.cond==='Do Not Fly';}).length;var bars=months.map(function(m){var h=maxCount>0?Math.max(4,Math.round((m.count/maxCount)*60)):4;return'<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;"><div style="font-size:10px;color:var(--muted);">'+(m.count||'')+'</div><div style="width:100%;background:var(--accent);border-radius:3px 3px 0 0;height:'+h+'px;min-height:4px;opacity:'+(m.count?'1':'0.15')+';display:flex;"></div><div style="font-size:9px;color:var(--muted);">'+m.label+'</div></div>';}).join('');return'<div class="card" style="border-color:rgba(245,158,11,.25);background:rgba(245,158,11,.04);"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;"><h2 class="card-ttl" style="margin-bottom:0;">Flight statistics</h2><span style="font-size:9px;font-weight:700;color:#f59e0b;background:rgba(245,158,11,.12);border-radius:3px;padding:1px 5px;">PRO</span></div><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Flights per month</div><div style="display:flex;align-items:flex-end;gap:4px;height:80px;margin-bottom:16px;">'+bars+'</div>'+(topLocs.length?'<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Top locations</div>'+topLocs.map(function(l){return'<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px;"><span style="color:var(--text);">'+esc(l)+'</span><span style="color:var(--muted);">'+locMap[l]+' flight'+(locMap[l]!==1?'s':'')+'</span></div>';}).join(''):'')+'<div style="display:flex;gap:8px;margin-top:12px;"><div style="flex:1;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:var(--radius-sm);padding:8px;text-align:center;"><div style="font-size:16px;font-weight:700;color:var(--green);">'+good+'</div><div style="font-size:10px;color:var(--muted);">Good</div></div><div style="flex:1;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:var(--radius-sm);padding:8px;text-align:center;"><div style="font-size:16px;font-weight:700;color:var(--amber);">'+caution+'</div><div style="font-size:10px;color:var(--muted);">Caution</div></div><div style="flex:1;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:var(--radius-sm);padding:8px;text-align:center;"><div style="font-size:16px;font-weight:700;color:var(--red);">'+avoid+'</div><div style="font-size:10px;color:var(--muted);">Avoided</div></div></div></div>';}
function prefetchSavedLocations(){
  if(!isPro())return;
  var favs=loadFavs();if(!favs.length)return;
  var fetched=0,total=favs.length;
  favs.forEach(function(fav){
    fetchOpenMeteo(fav.lat,fav.lng)
      .then(function(data){
        try{
          localStorage.setItem('dc_wx_fav_'+encodeURIComponent(fav.name),JSON.stringify({ts:Date.now(),data:data}));
          fetched++;
          if(fetched===total)showToast(total+' location'+(total>1?'s':'')+' cached for offline');
        }catch(e){}
      })
      .catch(function(){});
  });
}
var restrictMap=null,restrictHazardsLayer=null,restrictInitDone=false,activeHazardKeys={},_fetchDebTimer=null,_tileCache={},hazardLayerGroups={};
var NATS_LAYER_TYPES=[{key:'frz',color:'#ef4444',label:'Airport (FRZ)'},{key:'egr',color:'#f59e0b',label:'Other Restricted Area'},{key:'prohibited',color:'#7c3aed',label:'Prohibited Area'},{key:'danger',color:'#f97316',label:'Danger Area'}];
var activeNatsKeys={};NATS_LAYER_TYPES.forEach(function(n){activeNatsKeys[n.key]=true;});var natsLayerGroups={};
function toggleNatsLayer(key,enabled){activeNatsKeys[key]=enabled;var grp=natsLayerGroups[key];if(!grp||!restrictMap)return;if(enabled){if(!restrictMap.hasLayer(grp))grp.addTo(restrictMap);}else{grp.remove();}}
var HAZARD_TYPES=[{key:'school',color:'#9c27b0',fill:'#9c27b0',label:'School Grounds',note:'Privacy risk near schools.',query:'way["amenity"="school"];relation["amenity"="school"];'},{key:'railway',color:'#ffeb3b',fill:null,label:'Railway Infrastructure',note:'Network Rail 50m rule applies.',query:'way["railway"="rail"];'},{key:'nt',color:'#4caf50',fill:'#4caf50',label:'National Trust',note:'TOAL banned on most National Trust land.',query:'way["operator"="National Trust"];relation["operator"="National Trust"];'},{key:'prison',color:'#f44336',fill:'#f44336',label:'Prison / Secure Facility',note:'Strictly prohibited. No-fly zone.',query:'way["amenity"="prison"];relation["amenity"="prison"];'},{key:'military',color:'#795548',fill:'#795548',label:'Military Land',note:'MOD restrictions apply.',query:'way["landuse"="military"];relation["landuse"="military"];'},{key:'hospital',color:'#2196f3',fill:'#2196f3',label:'Hospital',note:'Sensitive airspace. Check local rules.',query:'way["amenity"="hospital"];relation["amenity"="hospital"];'},{key:'nature',color:'#8bc34a',fill:'#8bc34a',label:'Nature Reserve',note:'Many nature reserves restrict drones.',query:'way["leisure"="nature_reserve"];relation["leisure"="nature_reserve"];'},{key:'heritage',color:'#ff9800',fill:'#ff9800',label:'Heritage Site',note:'English Heritage restrictions may apply.',query:'way["historic"="monument"];way["historic"="castle"];relation["historic"="castle"];'},{key:'police',color:'#607d8b',fill:'#607d8b',label:'Police Station',note:'Sensitive site. Avoid flying over.',query:'way["amenity"="police"];'}];
HAZARD_TYPES.forEach(function(h){activeHazardKeys[h.key]=true;});var HAZARD_MAP={};HAZARD_TYPES.forEach(function(h){HAZARD_MAP[h.key]=h;});
function getHazardType(tags){
  if(tags.amenity==='school')return HAZARD_TYPES.find(function(h){return h.key==='school';});
  if(tags.railway==='rail')return HAZARD_TYPES.find(function(h){return h.key==='railway';});
  if(tags.operator==='National Trust')return HAZARD_TYPES.find(function(h){return h.key==='nt';});
  if(tags.amenity==='prison')return HAZARD_TYPES.find(function(h){return h.key==='prison';});
  if(tags.landuse==='military')return HAZARD_TYPES.find(function(h){return h.key==='military';});
  if(tags.amenity==='hospital')return HAZARD_TYPES.find(function(h){return h.key==='hospital';});
  if(tags.leisure==='nature_reserve')return HAZARD_TYPES.find(function(h){return h.key==='nature';});
  if(tags.historic==='monument'||tags.historic==='castle')return HAZARD_TYPES.find(function(h){return h.key==='heritage';});
  if(tags.amenity==='police')return HAZARD_TYPES.find(function(h){return h.key==='police';});
  return null;
}
function renderRestrictionsTab(){var el=document.getElementById('tab-restrict');if(!el)return;if(!isPro()){el.innerHTML='<div style="background:rgba(239,68,68,.06);border-bottom:1px solid rgba(239,68,68,.15);padding:8px 12px;display:flex;align-items:center;gap:8px;flex-shrink:0;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><div style="flex:1;font-size:11px;color:var(--muted);">Ground hazards only &mdash; not a substitute for official airspace checks.</div><span style="font-size:11px;font-weight:600;color:#ef4444;white-space:nowrap;flex-shrink:0;opacity:.45;">NOTAMs &#8599;</span><span style="font-size:11px;font-weight:600;color:#ef4444;white-space:nowrap;flex-shrink:0;opacity:.45;margin-left:6px;">Live Map &#8599;</span></div><div style="flex:1;display:flex;flex-direction:column;overflow:hidden;"><div class="paywall-card fill"><div class="paywall-blurred" style="padding:0;"><div style="height:280px;background:#e8ecef;position:relative;overflow:hidden;"><div style="position:absolute;inset:0;background:linear-gradient(135deg,#dce8dc 0%,#e8ecef 55%,#e0e8f0 100%);"></div><div style="position:absolute;top:43%;left:0;right:0;height:5px;background:rgba(255,255,255,.85);"></div><div style="position:absolute;top:42%;left:0;right:0;height:1px;background:rgba(170,170,170,.4);"></div><div style="position:absolute;top:48%;left:0;right:0;height:1px;background:rgba(170,170,170,.4);"></div><div style="position:absolute;top:-20%;left:38%;width:3px;height:150%;background:rgba(255,255,255,.7);transform:rotate(-18deg);transform-origin:top center;"></div><div style="position:absolute;top:14%;left:10%;width:68px;height:50px;background:#9c27b0;opacity:.22;border:2px solid rgba(156,39,176,.55);border-radius:3px;"></div><div style="position:absolute;top:55%;left:57%;width:115px;height:75px;background:#4caf50;opacity:.18;border:2px solid rgba(76,175,80,.5);border-radius:3px;"></div><div style="position:absolute;top:70%;left:-5%;right:-5%;height:5px;background:#ffeb3b;opacity:.9;transform:rotate(2deg);"></div><div style="position:absolute;top:69%;left:-5%;right:-5%;height:1px;background:#a09000;opacity:.5;transform:rotate(2deg);"></div><div style="position:absolute;top:75%;left:-5%;right:-5%;height:1px;background:#a09000;opacity:.5;transform:rotate(2deg);"></div><div style="position:absolute;top:26%;left:67%;width:42px;height:34px;background:#2196f3;opacity:.22;border:2px solid rgba(33,150,243,.5);border-radius:3px;"></div><div style="position:absolute;top:48%;left:50%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:50%;background:#38bdf8;border:2.5px solid white;box-shadow:0 0 0 5px rgba(56,189,248,.22);"></div><div style="position:absolute;bottom:8px;right:8px;background:white;border-radius:4px;width:22px;box-shadow:0 1px 4px rgba(0,0,0,.15);"><div style="height:22px;border-bottom:1px solid #ddd;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:#555;">+</div><div style="height:22px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:#555;">&#x2212;</div></div></div></div><div class="paywall-over">'+proCard({overlay:true,icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',title:'Restrictions Map',sub:'See schools, railways, National Trust land, hospitals and more &mdash; plotted on a live map for your area.',pills:['✈️ Airports / FRZ','🏫 Schools','🚉 Railways','🌳 National Trust','🏥 Hospitals','⛓️ Prisons','🪖 Military','🌿 Nature reserves','🏛️ Heritage sites','👮 Police stations']})+'</div></div></div><div style="background:var(--bg2);border-top:1px solid var(--border);padding:8px 12px;flex-shrink:0;"><div style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Airspace</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px;"><div style="display:flex;align-items:center;gap:5px;padding:3px 0;"><span style="width:10px;height:10px;border-radius:2px;background:#ef4444;flex-shrink:0;opacity:.8;display:inline-block;"></span><span style="font-size:10px;color:var(--text);">Airport (FRZ)</span></div><div style="display:flex;align-items:center;gap:5px;padding:3px 0;"><span style="width:10px;height:10px;border-radius:2px;background:#f59e0b;flex-shrink:0;opacity:.8;display:inline-block;"></span><span style="font-size:10px;color:var(--text);">Other Restricted Area</span></div><div style="display:flex;align-items:center;gap:5px;padding:3px 0;"><span style="width:10px;height:10px;border-radius:2px;background:#7c3aed;flex-shrink:0;opacity:.8;display:inline-block;"></span><span style="font-size:10px;color:var(--text);">Prohibited Area</span></div><div style="display:flex;align-items:center;gap:5px;padding:3px 0;"><span style="width:10px;height:10px;border-radius:2px;background:#f97316;flex-shrink:0;opacity:.8;display:inline-block;"></span><span style="font-size:10px;color:var(--text);">Danger Area</span></div></div></div><div style="background:var(--bg2);border-top:1px solid var(--border);padding:8px 12px;flex-shrink:0;"><div style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Hazard layers</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px;"><div style="display:flex;align-items:center;gap:5px;padding:3px 0;"><span style="width:10px;height:10px;border-radius:2px;background:#9c27b0;flex-shrink:0;opacity:.8;display:inline-block;"></span><span style="font-size:10px;color:var(--text);">School Grounds</span></div><div style="display:flex;align-items:center;gap:5px;padding:3px 0;"><span style="width:10px;height:10px;border-radius:2px;background:#ffeb3b;flex-shrink:0;opacity:.8;display:inline-block;"></span><span style="font-size:10px;color:var(--text);">Railway Infrastructure</span></div><div style="display:flex;align-items:center;gap:5px;padding:3px 0;"><span style="width:10px;height:10px;border-radius:2px;background:#4caf50;flex-shrink:0;opacity:.8;display:inline-block;"></span><span style="font-size:10px;color:var(--text);">National Trust</span></div><div style="display:flex;align-items:center;gap:5px;padding:3px 0;"><span style="width:10px;height:10px;border-radius:2px;background:#f44336;flex-shrink:0;opacity:.8;display:inline-block;"></span><span style="font-size:10px;color:var(--text);">Prison / Secure Facility</span></div><div style="display:flex;align-items:center;gap:5px;padding:3px 0;"><span style="width:10px;height:10px;border-radius:2px;background:#795548;flex-shrink:0;opacity:.8;display:inline-block;"></span><span style="font-size:10px;color:var(--text);">Military Land</span></div><div style="display:flex;align-items:center;gap:5px;padding:3px 0;"><span style="width:10px;height:10px;border-radius:2px;background:#2196f3;flex-shrink:0;opacity:.8;display:inline-block;"></span><span style="font-size:10px;color:var(--text);">Hospital</span></div><div style="display:flex;align-items:center;gap:5px;padding:3px 0;"><span style="width:10px;height:10px;border-radius:2px;background:#8bc34a;flex-shrink:0;opacity:.8;display:inline-block;"></span><span style="font-size:10px;color:var(--text);">Nature Reserve</span></div><div style="display:flex;align-items:center;gap:5px;padding:3px 0;"><span style="width:10px;height:10px;border-radius:2px;background:#ff9800;flex-shrink:0;opacity:.8;display:inline-block;"></span><span style="font-size:10px;color:var(--text);">Heritage Site</span></div><div style="display:flex;align-items:center;gap:5px;padding:3px 0;"><span style="width:10px;height:10px;border-radius:2px;background:#607d8b;flex-shrink:0;opacity:.8;display:inline-block;"></span><span style="font-size:10px;color:var(--text);">Police Station</span></div></div></div>';return;}if(restrictInitDone){if(restrictMap){restrictMap.invalidateSize();if(uLat&&uLng)flyToUserLocation(uLat,uLng);}return;}restrictInitDone=true;var legendHtml=HAZARD_TYPES.map(function(h){var onch='toggleHazardLayer(&apos;'+h.key+'&apos;,this.checked)';return'<label style="display:flex;align-items:center;gap:5px;cursor:pointer;padding:3px 0;"><input type="checkbox" checked onchange="'+onch+'" style="accent-color:'+h.color+';width:13px;height:13px;cursor:pointer;flex-shrink:0;"><span style="width:10px;height:10px;border-radius:2px;background:'+h.color+';flex-shrink:0;opacity:.8;display:inline-block;"></span><span style="font-size:10px;color:var(--text);">'+h.label+'</span></label>';}).join('');var natsLegendHtml=NATS_LAYER_TYPES.map(function(n){var onch='toggleNatsLayer(&apos;'+n.key+'&apos;,this.checked)';return'<label style="display:flex;align-items:center;gap:5px;cursor:pointer;padding:3px 0;"><input type="checkbox" checked onchange="'+onch+'" style="accent-color:'+n.color+';width:13px;height:13px;cursor:pointer;flex-shrink:0;"><span style="width:10px;height:10px;border-radius:2px;background:'+n.color+';flex-shrink:0;opacity:.8;display:inline-block;"></span><span style="font-size:10px;color:var(--text);">'+n.label+'</span></label>';}).join('');el.innerHTML='<div style="background:rgba(239,68,68,.06);border-bottom:1px solid rgba(239,68,68,.15);padding:8px 12px;display:flex;flex-direction:column;gap:4px;flex-shrink:0;"><div style="display:flex;align-items:center;gap:8px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><div style="flex:1;font-size:11px;color:var(--muted);">Ground hazards only - not a substitute for official airspace checks.</div><button onclick="openNotamLink()" style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.25);border-radius:6px;padding:5px 9px;font-size:11px;font-weight:600;color:#ef4444;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;">NOTAMs &#8599;</button><button onclick="openDroneMapLink()" style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.25);border-radius:6px;padding:5px 9px;font-size:11px;font-weight:600;color:#ef4444;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;">Live Map &#8599;</button></div><div style="font-size:11px;color:var(--muted);margin-left:22px;">Informational only &mdash; always confirm via the official NATS briefing before flying.</div></div><div id="restrict-map-el" style="flex:1;min-height:0;"></div><div style="background:var(--bg2);border-top:1px solid var(--border);padding:8px 12px;flex-shrink:0;"><div style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Airspace</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px;">'+natsLegendHtml+'</div></div><div style="background:var(--bg2);border-top:1px solid var(--border);padding:8px 12px;flex-shrink:0;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;"><span style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;">Hazard layers</span><span id="restrict-zoom-warn" style="font-size:10px;color:var(--amber);display:none;">Zoom in to see hazards</span><span id="restrict-load-status" style="font-size:10px;display:none;"></span></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px;">'+legendHtml+'</div></div>';setTimeout(function(){initRestrictMap();showToast('Zoom in on the map to load hazard data');},100);}
function initRestrictMap(){var mapEl=document.getElementById('restrict-map-el');if(!mapEl)return;if(restrictMap){restrictMap.invalidateSize();return;}var lat=uLat||51.5,lng=uLng||-0.1;restrictMap=L.map('restrict-map-el',{center:[lat,lng],zoom:13,zoomControl:true,attributionControl:true});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19}).addTo(restrictMap);restrictHazardsLayer=L.layerGroup().addTo(restrictMap);HAZARD_TYPES.forEach(function(h){hazardLayerGroups[h.key]=L.layerGroup().addTo(restrictMap);});if(uLat&&uLng){L.circleMarker([uLat,uLng],{radius:7,color:'#38bdf8',fillColor:'#38bdf8',fillOpacity:1,weight:2,interactive:false}).addTo(restrictMap);}restrictMap.on('moveend',fetchGroundHazards);restrictMap.on('zoomend',fetchGroundHazards);
  // ── Locate button overlay ──
  var locBtn=document.createElement('button');
  locBtn.id='restrict-locate-btn';
  locBtn.title='Go to my location';
  locBtn.setAttribute('aria-label','Centre map on my location');
  locBtn.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>';
  locBtn.style.cssText='position:absolute;bottom:60px;right:10px;z-index:1000;width:36px;height:36px;background:#334155;border:1px solid rgba(255,255,255,.2);border-radius:9px;color:#f1f5f9;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit;transition:color .15s,border-color .15s;';
  locBtn.onclick=locateOnRestrictMap;
  mapEl.style.position='relative';
  mapEl.appendChild(locBtn);
  setTimeout(function(){restrictMap.invalidateSize();},200);setTimeout(function(){fetchGroundHazards();loadNatsFrz();},800);}
function locateOnRestrictMap(){
  var btn=document.getElementById('restrict-locate-btn');
  if(!restrictMap)return;
  // Spin the icon while locating
  if(btn){btn.style.color='var(--accent)';btn.style.borderColor='rgba(56,189,248,.5)';}
  function panTo(lat,lng,fromGps){
    if(btn){btn.style.color='rgba(241,245,249,.85)';btn.style.borderColor='rgba(255,255,255,.12)';}
    restrictMap.flyTo([lat,lng],14,{duration:0.8});
    // Drop a brief pulse marker
    var pulse=L.circleMarker([lat,lng],{radius:10,color:'#38bdf8',fillColor:'#38bdf8',fillOpacity:0.25,weight:2,interactive:false}).addTo(restrictMap);
    setTimeout(function(){if(restrictMap)restrictMap.removeLayer(pulse);},2500);
    if(fromGps)showToast('📍 Centred on your GPS position');
    else showToast('📍 Centred on '+document.getElementById('loc-name').textContent);
  }
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(
      function(p){panTo(p.coords.latitude,p.coords.longitude,true);},
      function(){
        // GPS denied/failed — fall back to searched location
        if(uLat&&uLng){panTo(uLat,uLng,false);}
        else{if(btn){btn.style.color='rgba(241,245,249,.85)';btn.style.borderColor='rgba(255,255,255,.12)';}showToast('No location available');}
      },
      {timeout:6000,maximumAge:30000}
    );
  } else if(uLat&&uLng){
    panTo(uLat,uLng,false);
  } else {
    if(btn){btn.style.color='rgba(241,245,249,.85)';btn.style.borderColor='rgba(255,255,255,.12)';}
    showToast('No location available');
  }
}
function flyToUserLocation(lat,lng){if(!restrictMap)return;restrictMap.flyTo([lat,lng],restrictMap.getZoom()||13,{duration:0.8});}
function fetchGroundHazards(){if(_fetchDebTimer)clearTimeout(_fetchDebTimer);_fetchDebTimer=setTimeout(_doFetchGroundHazards,400);}
function _doFetchGroundHazards(){if(!restrictMap||!restrictHazardsLayer)return;var zoom=restrictMap.getZoom();var warn=document.getElementById('restrict-zoom-warn');if(zoom<11){if(warn){warn.style.display='';warn.textContent='Zoom in further to see hazards (current zoom: '+Math.round(zoom)+')';}restrictHazardsLayer.clearLayers();HAZARD_TYPES.forEach(function(h){if(hazardLayerGroups[h.key])hazardLayerGroups[h.key].clearLayers();});return;}if(warn)warn.style.display='none';var statusEl=document.getElementById('restrict-load-status');var ts=0.25,bounds=restrictMap.getBounds(),tileKeys=[],sLat=Math.floor(bounds.getSouth()*4)/4,nLat=Math.floor(bounds.getNorth()*4)/4,wLng=Math.floor(bounds.getWest()*4)/4,eLng=Math.floor(bounds.getEast()*4)/4;for(var la=sLat;la<=nLat+0.001;la=Math.round((la+ts)*1000)/1000){for(var lo=wLng;lo<=eLng+0.001;lo=Math.round((lo+ts)*1000)/1000){tileKeys.push(la+'_'+lo);}}var needFetch=tileKeys.filter(function(k){return _tileCache[k]===undefined;});if(!needFetch.length){renderHazardFeaturesFromCache(tileKeys,statusEl);return;}if(statusEl){statusEl.style.display='';statusEl.style.color='var(--muted)';statusEl.textContent='Loading…';}var pending=needFetch.length;needFetch.forEach(function(key){fetch('/hazard-tiles/v1/'+key+'.geojson').then(function(r){if(r.status===404){_tileCache[key]=[];return;}if(!r.ok)throw new Error('HTTP '+r.status);return r.json().then(function(d){_tileCache[key]=(d&&d.features)||[];});}).catch(function(){_tileCache[key]=[];}).then(function(){pending--;if(pending===0)renderHazardFeaturesFromCache(tileKeys,statusEl);});}); }
function renderHazardFeaturesFromCache(tileKeys,statusEl){var seen={},all=[];tileKeys.forEach(function(k){(_tileCache[k]||[]).forEach(function(f){if(f.id){if(seen[f.id])return;seen[f.id]=true;}all.push(f);});});renderHazardFeatures(all,statusEl);}
function renderHazardFeatures(features,statusEl){HAZARD_TYPES.forEach(function(h){if(hazardLayerGroups[h.key])hazardLayerGroups[h.key].clearLayers();});var byType={};features.forEach(function(f){if(!f.properties||!f.geometry||f.geometry.type==='Point'||f.geometry.type==='MultiPoint')return;var key=f.properties.hazard;if(!byType[key])byType[key]=[];byType[key].push(f);});Object.keys(byType).forEach(function(key){var grp=hazardLayerGroups[key];if(!grp)return;var h=HAZARD_MAP[key];L.geoJSON({type:'FeatureCollection',features:byType[key]},{style:function(feature){var h=HAZARD_MAP[feature.properties.hazard];if(!h)return{color:'#999',weight:1,fillOpacity:.15};return{color:h.color,weight:h.key==='railway'?4:2,fillColor:h.fill||h.color,fillOpacity:h.fill?.25:0,opacity:.85};},onEachFeature:function(feature,layer){var p=feature.properties||{};var h=HAZARD_MAP[p.hazard];var title=h?h.label:'Ground Restriction';var name=p.name||p.operator||(h?h.label:'Unknown');var note=h?h.note:'Check local rules before flying.';layer.bindPopup('<strong style=\"color:'+(h?h.color:'#999')+';\">'  +esc(title)+'</strong><br><span style=\"font-size:12px;\">'  +esc(name)+'</span><br><span style=\"font-size:11px;color:#888;line-height:1.5;\">'  +note+'</span>');}}).addTo(grp);if(!activeHazardKeys[key]){grp.remove();}else if(restrictMap&&!restrictMap.hasLayer(grp)){grp.addTo(restrictMap);}});if(statusEl){statusEl.style.display='';statusEl.style.color='#22c55e';statusEl.textContent='✓ Up to date';setTimeout(function(){var s=document.getElementById('restrict-load-status');if(s)s.style.display='none';},3000);}}
function getHazardType(tags){if(tags.amenity==='school')return HAZARD_TYPES[0];if(tags.railway==='rail')return HAZARD_TYPES[1];if((tags.operator||'').indexOf('National Trust')>=0)return HAZARD_TYPES[2];if(tags.amenity==='prison')return HAZARD_TYPES[3];if(tags.landuse==='military')return HAZARD_TYPES[4];if(tags.amenity==='hospital')return HAZARD_TYPES[5];if(tags.leisure==='nature_reserve')return HAZARD_TYPES[6];if(tags.historic==='monument'||tags.historic==='castle')return HAZARD_TYPES[7];if(tags.amenity==='police')return HAZARD_TYPES[8];return null;}
var natsFrzLayer=null,natsFilesLoaded=false;
function loadNatsFrz(){
  if(natsFilesLoaded||!restrictMap)return;
  natsFilesLoaded=true;

  // Helper: style by type
  function styleFor(color,fillOpacity){
    return{color:color,weight:2,fillColor:color,fillOpacity:fillOpacity,opacity:0.9};
  }
  // Helper: popup with vertical limits
  function bindPopup(layer,name,typeLabel,color,upper,lower){
    var limitsHtml='';
    if(upper||lower){
      limitsHtml='<br><span style="font-size:11px;color:#94a3b8;line-height:1.8;">'
        +(upper?'↑ '+esc(upper):'')
        +(upper&&lower?' &nbsp;·&nbsp; ':'')
        +(lower&&lower!=='SFC'?'↓ '+esc(lower):lower==='SFC'?'↓ Surface':'')
        +'</span>';
    }
    layer.bindPopup(
      '<strong style="color:'+color+';">'+esc(name)+'</strong>'+
      '<br><span style="font-size:11px;color:'+color+';font-weight:600;">'+typeLabel+'</span>'+
      limitsHtml
    );
  }

  // 1. FRZ / Restricted (red for FRZ prefix, amber for EGR prefix)
  fetch('/Restricted_drone.geojson')
    .then(function(r){if(!r.ok)throw new Error('not found');return r.json();})
    .then(function(data){
      // Split into aerodrome FRZ (red, "EGR<n>U..." sub-numbering) and other EGR
      // Restricted Areas (amber, e.g. nuclear sites, royal residences, military ports)
      var frzFeatures=[];
      var egrFeatures=[];
      (data.features||[]).forEach(function(f){
        var name=(f.properties&&(f.properties.Name||f.properties.name))||'';
        if(/^EGR\d*U/i.test(name)) frzFeatures.push(f);
        else egrFeatures.push(f);
      });

      // Airport FRZ (red)
      if(frzFeatures.length){
        natsFrzLayer=L.geoJSON({type:'FeatureCollection',features:frzFeatures},{
          style:function(){return styleFor('#ef4444',0.15);},
          onEachFeature:function(feature,layer){
            var p=feature.properties||{};
            var name=p.Name||p.name||'Flight Restriction Zone';
            bindPopup(layer,name,'Airport Flight Restriction Zone (FRZ)','#ef4444',p.upper,p.lower);
          }
        });
        addNatsLayer('frz',natsFrzLayer);
      }

      // EGR Restricted (amber)
      if(egrFeatures.length){
        var egrLayer=L.geoJSON({type:'FeatureCollection',features:egrFeatures},{
          style:function(){return styleFor('#f59e0b',0.1);},
          onEachFeature:function(feature,layer){
            var p=feature.properties||{};
            var name=p.Name||p.name||'Restricted Area';
            bindPopup(layer,name,'Other Restricted Area','#f59e0b',p.upper,p.lower);
          }
        });
        addNatsLayer('egr',egrLayer);
      }
      showToast('NATS airspace loaded');
    }).catch(function(){});

  // 2. Prohibited (purple)
  fetch('/Prohibited.geojson')
    .then(function(r){if(!r.ok)throw new Error('not found');return r.json();})
    .then(function(data){
      var prohibitedLayer=L.geoJSON(data,{
        style:function(){return styleFor('#7c3aed',0.15);},
        onEachFeature:function(feature,layer){
          var p=feature.properties||{};
          var name=p.Name||p.name||'Prohibited Area';
          bindPopup(layer,name,'Prohibited Area','#7c3aed',p.upper,p.lower);
        }
      });
      addNatsLayer('prohibited',prohibitedLayer);
    }).catch(function(){});

  // 3. Danger (orange)
  fetch('/Danger.geojson')
    .then(function(r){if(!r.ok)throw new Error('not found');return r.json();})
    .then(function(data){
      var dangerLayer=L.geoJSON(data,{
        style:function(){return styleFor('#f97316',0.1);},
        onEachFeature:function(feature,layer){
          var p=feature.properties||{};
          var name=p.Name||p.name||'Danger Area';
          bindPopup(layer,name,'Danger Area','#f97316',p.upper,p.lower);
        }
      });
      addNatsLayer('danger',dangerLayer);
    }).catch(function(){});
}
function addNatsLayer(key,layer){var grp=L.layerGroup([layer]);natsLayerGroups[key]=grp;if(activeNatsKeys[key]!==false&&restrictMap)grp.addTo(restrictMap);}
function toggleHazardLayer(key,enabled){activeHazardKeys[key]=enabled;var grp=hazardLayerGroups[key];if(!grp||!restrictMap)return;if(enabled){if(!restrictMap.hasLayer(grp))grp.addTo(restrictMap);}else{grp.remove();}}
function openNotamLink(){window.open('https://nats-uk.ead-it.com/cms-nats/opencms/en/home/','_blank','noopener,noreferrer');}
function openDroneMapLink(){window.open('https://thedronemap.com','_blank','noopener,noreferrer');}
