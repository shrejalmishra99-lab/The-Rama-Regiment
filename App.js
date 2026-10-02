let S=JSON.parse(sessionStorage.getItem("s")||"null");const hdr=()=>S&&S.token?{Authorization:"Bearer "+S.token}:{};
const API="",$=s=>document.querySelector(s),app=$("#app"),T=["ICU","Ventilator","Oxygen","Cardiac","Burns","Trauma","NICU","Stroke"],COND={"Cardiac arrest":["ICU","Cardiac","Ventilator"],"Heart attack":["ICU","Cardiac"],"Stroke":["ICU","Stroke"],"Road accident / trauma":["ICU","Trauma","Oxygen"],"Severe burns":["Burns","ICU"],"Breathing difficulty":["Oxygen","Ventilator"],"Newborn emergency":["NICU","Oxygen"]};
const j=(p,m="GET",b)=>fetch(API+p,{method:m,headers:{"Content-Type":"application/json",...hdr()},body:b&&JSON.stringify(b)}).then(r=>{if(r.status==401&&S&&S.role=="a"){sessionStorage.removeItem("s");location.reload()}return r.json()});
const COL={green:"#1e9e5a",yellow:"#d99a00",red:"#d7263d"},bd=a=>a<10?"green":a<=30?"yellow":"red",fmt=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
let tab,tm=[],map,mk={},pick,amb,rt,H=[],hid=1,rid=null,needs=new Set(["ICU","Ventilator"]),res=null;
const every=(f,ms)=>{f();tm.push(setInterval(f,ms))};
function ring(left,total){const r=52,c=2*Math.PI*r,col=left<30?"#d7263d":"#0f7b8a";
 return `<div class="ringbox"><svg width="130" height="130" viewBox="0 0 130 130"><circle cx="65" cy="65" r="${r}" fill="none" stroke="#e3e9ef" stroke-width="10"/><circle cx="65" cy="65" r="${r}" fill="none" stroke="${col}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-left/total)}" transform="rotate(-90 65 65)"/><text x="65" y="74" text-anchor="middle" font-size="30" font-weight="700" font-family="Newsreader" fill="#0e1b2c">${fmt(left)}</text></svg></div>`}
const tl=q=>`<div class="tl">${q.offers.map((o,i)=>`${i?"→":""}<span class="${o.status}">${o.name.split(",")[0]}: ${{timeout:"no reply",rejected:"rejected",accepted:"accepted",offered:"waiting"}[o.status]}</span>`).join("")}</div>`;
const left=(q,o)=>Math.max(0,Math.round(o.expires_at-(Date.now()/1000+q.server_time-Date.now()/1000)));
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>show(b.dataset.t));
function show(t){if(!S)t="login";tm.forEach(clearInterval);tm=[];if(map){map.remove();map=null;mk={};amb=rt=null}tab=t;
 document.querySelectorAll("nav button").forEach(b=>{b.style.display=S&&b.dataset.r==S.role?"":"none";b.classList.toggle("on",b.dataset.t==t)});$("#lo").style.display=S?"":"none";$("#bk").style.display=S?"":"none";$("#lo").textContent=S?.role=="a"?"Sign out · "+S.name.split(",")[0]:"Sign out";document.body.classList.toggle("anon",!S);$("#pt").textContent={login:"Sign in",dash:"Emergency dispatch",er:S?.name||"",admin:S?.name||""}[t];({login,dash,er,admin})[t]()}
$("#lo").onclick=()=>{sessionStorage.removeItem("s");S=null;rid=null;show("login")};
$("#bk").onclick=()=>{if(tab=="dash"&&rid){rid=null;show("dash")}else if(tab=="admin"){show("er")}else $("#lo").onclick()};
const age=h=>Math.min(...T.map(t=>h.beds[t].age_min));
const hsel=()=>`<select id="hs">${H.map(h=>`<option value="${h.id}" ${h.id==hid?"selected":""}>${h.name}</option>`).join("")}</select>`;

/* ---------- DISPATCH DASHBOARD ---------- */
function dash(){
 if(typeof L==="undefined"){app.innerHTML=`<div class="page"><div class="card warn">Map library failed to load. Check your internet connection (Leaflet loads from cdnjs.cloudflare.com), then refresh.</div></div>`;return}
 app.innerHTML=`<section class="dash"><div class="mapwrap"><div class="kpis" id="kpi"></div><div id="map"></div><div class="feed" id="feed"></div></div><aside id="side"></aside></section>`;
 map=L.map("map",{zoomControl:false}).setView([19.07,72.86],12);L.control.zoom({position:"bottomright"}).addTo(map);
 const t1=L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",{subdomains:"abcd",maxZoom:19,attribution:"© OpenStreetMap © CARTO"}).addTo(map);let fb=0;
 t1.on("tileerror",()=>{if(fb++==3){map.removeLayer(t1);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap"}).addTo(map)}});
 setTimeout(()=>map&&map.invalidateSize(),250);
 pick=L.marker([19.076,72.8777],{draggable:true,icon:L.divIcon({className:"",html:'<div class="pickup"></div>',iconSize:[22,22]})}).addTo(map).bindTooltip("Patient pickup: drag to move");
 every(async()=>{const HH=await j("/api/hospitals");if(!Array.isArray(HH)){$("#feed").innerHTML="<b>Cannot reach server</b>Is uvicorn running? Open http://localhost:8000";return}H=HH;const RQ=await j("/api/requests");
  H.forEach(h=>{const a=age(h),c=COL[bd(a)],ic=`<div class="hp" style="--c:${c}"><b>${h.beds.ICU.count}</b></div>`,
   pop=`<b>${h.name}</b><br>${T.map(t=>`${t} ${h.beds[t].count}`).join(" · ")}<br>${{green:'🟢 Fresh',yellow:'🟡 Aging',red:'🔴 Stale'}[bd(a)]} · updated ${a} min ago`;
   if(mk[h.id]){mk[h.id].setIcon(L.divIcon({className:"",html:ic,iconSize:[34,34],iconAnchor:[17,34]})).setPopupContent(pop)}
   else mk[h.id]=L.marker([h.lat,h.lng],{icon:L.divIcon({className:"",html:ic,iconSize:[34,34],iconAnchor:[17,34]})}).addTo(map).bindPopup(pop)});
  const s=t=>H.reduce((x,h)=>x+h.beds[t].count,0);
  $("#kpi").innerHTML=[[RQ.filter(q=>["OFFERED","HELD"].includes(q.status)).length,"active emergencies"],[s("ICU"),"ICU beds free"],[s("Ventilator"),"ventilators free"],[RQ.filter(q=>q.status=="HELD").length,"ambulances en route"],[RQ.filter(q=>q.status=="OFFERED").length,"awaiting hospital"]].map(([v,l])=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join("");
  const LG=await j("/api/log?limit=6"),nm=id=>(H.find(h=>h.id==id)?.name||"").split(",")[0],
   ev=[...RQ.flatMap(q=>q.offers.map(o=>({t:o.offered_at,m:`${nm(o.hid)}: ${o.status} (#${q.id})`}))),...LG.map(l=>({t:l.ts,m:`${nm(l.hospital_id)} ${l.bed_type} ${l.old_count}→${l.new_count}`}))].sort((a,b)=>b.t-a.t).slice(0,6);
  $("#feed").innerHTML="<b>Live activity</b>"+ev.map(e=>`<div>${new Date(e.t*1000).toLocaleTimeString()} · ${e.m}</div>`).join("");
  $("#lv").textContent="Live · "+new Date().toLocaleTimeString()},5000);
 rid?live():find();
}
const bk=h=>{const R=[["Bed match",h.match],["ETA",Math.max(0,Math.round(100-h.eta_min*100/60))],["Freshness",Math.round(100*Math.exp(-.025*h.oldest_min))],["At arrival",h.at_arrival],["Low load",100-h.load]];
 return `<div class="bk">${R.map(([k,v])=>`<div><span>${k}</span><div class="bar"><i style="width:${v}%;background:var(--teal)"></i></div><b>${v}</b></div>`).join("")}<div class="ov">BedLink match score <b>${Math.round(h.score*100)}</b>. Based on beds, travel time, data freshness and predicted availability.</div></div>`};
function find(){
 $("#side").innerHTML=`<h2>Where does the patient need to go?</h2><p class="m">Pick the beds needed, then drag the black pin on the map to the pickup point.</p>
 <div class="chips">${T.map(t=>`<button class="chip ${needs.has(t)?"on":""}" data-n="${t}">${t}</button>`).join("")}</div>
 <p class="m" style="margin:0">Or pick the condition and beds are selected for you:</p><div class="chips">${Object.keys(COND).map(c=>`<button class="chip" data-c="${c}">${c}</button>`).join("")}</div>
 <input type="text" id="cond" placeholder="Condition, e.g. cardiac arrest (no names)"><button class="btn alt" id="loc">Use my location</button>
 <button class="btn" id="go">Find best hospital</button><div id="out"></div>`;
 document.querySelectorAll(".chip[data-n]").forEach(b=>b.onclick=()=>{needs.has(b.dataset.n)?needs.delete(b.dataset.n):needs.add(b.dataset.n);b.classList.toggle("on")});
 document.querySelectorAll(".chip[data-c]").forEach(b=>b.onclick=()=>{needs=new Set(COND[b.dataset.c]);$("#cond").value=b.dataset.c;document.querySelectorAll(".chip[data-n]").forEach(c=>c.classList.toggle("on",needs.has(c.dataset.n)))});
 $("#loc").onclick=()=>navigator.geolocation?.getCurrentPosition(p=>{pick.setLatLng([p.coords.latitude,p.coords.longitude]);map.setView(pick.getLatLng(),13)});
 $("#go").onclick=async()=>{const p=pick.getLatLng();if(!needs.size)return;
  res={needs:[...needs],lat:p.lat,lng:p.lng,r:await j("/api/rank","POST",{needs:[...needs],lat:p.lat,lng:p.lng})};const r=res.r;
  const tag=(ok,t)=>`<span class="tg ${ok?"y":"n"}">${ok?"✓":"✕"} ${t}</span>`,mc=v=>v<40?"var(--red)":v<70?"var(--y)":"var(--g)";
  $("#out").innerHTML=(r.partial_mode?`<p class="warn">No hospital has every bed. Showing the best partial matches.</p>`:"")+r.results.map((h,i)=>`<div class="res ${i?"":"best"}" data-id="${h.id}">
   <div class="eta"><b>${h.eta_min}</b><span>min</span><i>${h.dist_km} km</i></div>
   <div><div class="nm">${i?"":'<span class="pill">Best match</span>'}<b>${h.name}</b></div>
   <div class="tags">${Object.entries(h.needs).map(([k,v])=>tag(v.reported>0,k+(v.reported?" ~"+v.likely_free:""))).join("")}</div>
   <div class="fresh"><i style="background:${COL[h.badge]}"></i>${h.oldest_min} min old · load ${h.load}%</div>
   <div class="meter"><span>At arrival</span><div class="bar"><i style="width:${h.at_arrival}%;background:${mc(h.at_arrival)}"></i></div><b>${h.at_arrival}%</b></div>
   ${i?"":bk(h)}${h.risk=="HIGH"?`<div class="warn">High risk: bed may be gone on arrival</div>`:""}${h.missing.length?`<div class="warn">Missing: ${h.missing.join(", ")}</div>`:""}
   ${i<3?`<button class="btn" data-send="1">Request this hospital</button>`:""}</div></div>`).join("")+
   (r.nearest_stabilise?`<p class="m">Nearest to stabilise: <b>${r.nearest_stabilise.name}</b> (${r.nearest_stabilise.eta_min} min)</p>`:"");
  document.querySelectorAll(".res").forEach(c=>c.onclick=()=>{const h=H.find(x=>x.id==c.dataset.id);map.flyTo([h.lat,h.lng],14);mk[h.id].openPopup()});
  document.querySelectorAll("[data-send]").forEach(b=>b.onclick=async e=>{e.stopPropagation();
   const q=await j("/api/requests","POST",{needs:res.needs,lat:res.lat,lng:res.lng,condition:$("#cond").value});rid=q.id;live()})};
}
function live(){
 every(async()=>{const q=await j("/api/requests/"+rid),o=q.offers[q.offers.length-1];let h=H.find(x=>x.id==o.hid),body="";
  if(q.status=="OFFERED")body=`<p class="m">Waiting for ${o.name}</p>${ring(left(q,o),120)}`;
  if(q.status=="HELD"){body=`<p><b style="color:var(--g)">Bed held at ${o.name}</b></p><div class="num">Ambulance ETA ${q.ambulance.eta_min} min</div>`;
   const a=[q.ambulance.lat,q.ambulance.lng];amb?amb.setLatLng(a):amb=L.marker(a,{icon:L.divIcon({className:"",html:'<div class="amb">🚑</div>',iconSize:[34,34]})}).addTo(map);
   if(h){rt?.remove();rt=L.polyline([pick.getLatLng(),[h.lat,h.lng]],{color:"#0f7b8a",dashArray:"6 8"}).addTo(map)}}
  if(q.status=="EXHAUSTED")body=`<p class="warn">No hospital accepted. Go to the nearest stabilising hospital.</p>`;
  $("#side").innerHTML=`<h2>Request ${q.id}</h2><div class="m">${q.needs.join(" + ")} · ${q.condition||"no note"}</div>${body}<h2 style="margin-top:14px;font-size:16px">Offer timeline</h2>${tl(q)}<button class="btn alt" id="nw">New request</button>`;
  $("#nw").onclick=()=>{rid=null;amb?.remove();rt?.remove();amb=rt=null;tm.forEach(clearInterval);tm=[];dash()}},1000);
}

/* ---------- LOGIN ---------- */
async function login(){H=await j("/api/hospitals");
 app.innerHTML=`<div class="login"><div class="hero"><svg width="560" height="90" viewBox="0 0 560 90" fill="none" stroke="#7fd1c6" stroke-width="2"><path d="M0 45h150l14-34 22 68 20-48 14 14h340"/></svg>
 <div style="font:600 24px var(--serif)">BedLink</div><h1>The right bed, at the right hospital, right now.</h1><p>Live bed availability across ${H.length} Mumbai hospitals, with a two-minute confirmation and a bed held for every ambulance.</p></div>
 <div class="form"><h2>Sign in</h2><div class="card"><b>Dispatcher</b><p class="m">See every hospital and send requests.</p><button class="btn" id="d">Continue as dispatcher</button></div>
 <div class="card"><b>Hospital admin</b><p class="m">You only see and update your own hospital.</p><select id="hs">${H.map(h=>`<option value="${h.id}">#${String(h.id).padStart(2,"0")} · ${h.name}</option>`).join("")}</select>
 <p class="m" id="ph"></p><input type="text" id="pin" inputmode="numeric" placeholder="Enter PIN"><button class="btn ok" id="a">Sign in</button><p class="warn" id="er"></p></div></div></div>`;
 const go=x=>{S=x;sessionStorage.setItem("s",JSON.stringify(x));show(x.role=="d"?"dash":"er")};
 const ph=()=>$("#ph").textContent="Demo PIN for this hospital: "+String($("#hs").value).padStart(4,"0");$("#hs").onchange=ph;ph();
 $("#d").onclick=()=>go({role:"d"});
 $("#a").onclick=async()=>{const r=await j("/api/login","POST",{hospital_id:+$("#hs").value,pin:$("#pin").value});r.token?go({role:"a",token:r.token,hid:r.hospital_id,name:r.name}):$("#er").textContent="Wrong PIN. Demo PIN is the hospital number as 4 digits."}}

/* ---------- HOSPITAL ER (own hospital only) ---------- */
async function er(){hid=S.hid;
 app.innerHTML=`<div class="page"><p class="m">Incoming emergency requests for your hospital</p><div id="inc"></div></div>`;
 every(async()=>{const L=await j(`/api/hospitals/${hid}/offers`);
  $("#inc").innerHTML=L.length?L.map(q=>{const o=q.offers[q.offers.length-1];return `<div class="card"><div class="m">Request ${q.id}</div><h2>${q.needs.join(" + ")}</h2><div>${q.condition||"No note"}</div>`+
   (q.status=="OFFERED"?`${ring(left(q,o),120)}<p class="m" style="text-align:center">Accept within 2 minutes or the next hospital is called.</p><button class="btn ok" data-a="1" data-id="${q.id}">Accept and hold bed</button><button class="btn alt" data-a="0" data-id="${q.id}">Reject</button>`
   :`<p><b style="color:var(--g)">Bed reserved. Prepare the team.</b></p><div class="num">Arrives in ${q.ambulance.eta_min} min</div><div class="m">Live position ${q.ambulance.lat.toFixed(4)}, ${q.ambulance.lng.toFixed(4)}</div>`)+`</div>`}).join("")
   :`<div class="card m">No incoming requests for ${S.name}.</div>`;
  document.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>j(`/api/requests/${b.dataset.id}/respond`,"POST",{accept:b.dataset.a=="1"}))},1000)}

/* ---------- BED UPDATE (own hospital only) ---------- */
async function admin(){hid=S.hid;H=await j("/api/hospitals");const h=H.find(x=>x.id==hid);
 app.innerHTML=`<div class="page"><p class="m">Update your beds. Other hospitals are not visible to you.</p><div class="card">${T.map(t=>`<div class="bed"><span class="t">${t}</span><button data-t="${t}" data-d="-1" aria-label="${t} minus">−</button><span class="n">${h.beds[t].count}</span><button data-t="${t}" data-d="1" aria-label="${t} plus">+</button></div>`).join("")}
 <div class="m">Last updated ${age(h)} min ago</div></div><button class="btn ok" id="cf" style="min-height:60px">No change, still accurate</button><p class="m" id="msg"></p></div>`;
 document.querySelectorAll(".bed button").forEach(b=>b.onclick=async()=>{await j("/api/beds/"+hid,"POST",{bed_type:b.dataset.t,delta:+b.dataset.d});admin()});
 $("#cf").onclick=async()=>{await j(`/api/beds/${hid}/confirm`,"POST");$("#msg").textContent="Saved. Freshness reset."}}

/* ===== additive enhancements (existing code above is unchanged) ===== */
(function(){
const $$=(s,r=document)=>[...r.querySelectorAll(s)],FB={green:["🟢","Fresh"],yellow:["🟡","Old"],red:["🔴","Very old"]};
const clk=ts=>new Date(ts*1000).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
document.body.insertAdjacentHTML("beforeend",'<div id="toast"></div>');
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove("on"),2200)};
const AREAS={Bandra:[19.0596,72.8295],Andheri:[19.1197,72.8468],Dadar:[19.0178,72.8478],Colaba:[18.9067,72.8147],Worli:[19.0176,72.8174],Juhu:[19.1075,72.8263],Kurla:[19.0726,72.8845],Ghatkopar:[19.086,72.9081],Chembur:[19.0522,72.9005],Powai:[19.1176,72.906],Borivali:[19.2307,72.8567],Mulund:[19.1726,72.9425]};
/* ---- DISPATCH: working location + feature cards ---- */
const _f=find;find=function(){_f();
 const say=(m,bad)=>{const e=$("#ploc");e.textContent=m;e.className=bad?"warn":"m"};
 const ploc=async lab=>{const p=pick.getLatLng();say(`Pickup: ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`+(lab?` · ${lab}`:""));
  if(!lab)try{const r=await(await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=17&lat=${p.lat}&lon=${p.lng}`)).json();if(r.display_name)say(`Pickup: ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)} · ${r.display_name.split(",").slice(0,3).join(",")}`)}catch(e){}};
 const set=(la,ln,lab)=>{pick.setLatLng([la,ln]);map.setView([la,ln],14);ploc(lab)};
 $("#go").insertAdjacentHTML("beforebegin",`<div class="locbox"><b>Patient location</b><div id="ploc" class="m"></div><div class="row2"><input type="text" id="lq" placeholder="Search area or address in Mumbai"><button class="btn alt" id="lsb">Search</button></div><div id="lres"></div><div class="chips">${Object.keys(AREAS).map(a=>`<button class="chip" data-a="${a}">${a}</button>`).join("")}</div><p class="m" style="margin:0">Or click anywhere on the map, or drag the pin.</p></div>`);
 const old=$("#loc"),nb=old.cloneNode(true);old.replaceWith(nb);
 nb.onclick=()=>{if(!navigator.geolocation)return say("Location is not supported here. Search, pick an area or click the map.",1);nb.textContent="Locating…";
  navigator.geolocation.getCurrentPosition(p=>{nb.textContent="Use my location";set(p.coords.latitude,p.coords.longitude,"your location")},e=>{nb.textContent="Use my location";say(e.code==1?"Location is blocked. Click the lock icon in the address bar and allow location, or search / pick an area / click the map.":"Could not get your location. Search, pick an area or click the map.",1)},{enableHighAccuracy:true,timeout:10000})};
 $$(".locbox [data-a]").forEach(b=>b.onclick=()=>set(...AREAS[b.dataset.a],b.dataset.a));
 const srch=async()=>{const q=$("#lq").value.trim();if(!q)return;$("#lres").innerHTML='<p class="m">Searching…</p>';
  try{const r=await(await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&q="+encodeURIComponent(q+", Mumbai"))).json();
   $("#lres").innerHTML=r.length?r.map((x,i)=>`<button data-i="${i}">${x.display_name.split(",").slice(0,3).join(",")}</button>`).join(""):'<p class="warn">No match. Try an area button.</p>';
   $$("#lres button").forEach(b=>b.onclick=()=>{const x=r[b.dataset.i];set(+x.lat,+x.lon,b.textContent);$("#lres").innerHTML=""})}catch(e){$("#lres").innerHTML='<p class="warn">Search needs internet. Use the area buttons or click the map.</p>'}};
 $("#lsb").onclick=srch;$("#lq").onkeydown=e=>{if(e.key=="Enter")srch()};
 map.on("click",e=>{pick.setLatLng(e.latlng);ploc()});pick.on("dragend",()=>ploc());ploc("default point (drag, click or search to change)");
 const deco=()=>{const r=res&&res.r;if(!r||$("#bestbox"))return;const b=r.results[0],cf=h=>Math.min(...Object.values(h.needs).map(v=>v.confidence));
  $("#out").insertAdjacentHTML("afterbegin",`<div class="bestbox" id="bestbox"><h3>🏆 ${r.partial_mode?"Best partial match":"Best Match"}: ${b.name}</h3><div class="g">${Object.entries(b.needs).map(([k,v])=>`<span>${k}: ${v.reported?"✅":"❌"}</span>`).join("")}<span>Distance: ${b.dist_km} km</span><span>ETA: ${b.eta_min} min</span><span>Availability confidence: <b>${cf(b)}%</b></span><span>At arrival: <b>${b.at_arrival}%</b></span></div>${b.missing.length?`<div class="warn">missing: ${b.missing.join(", ")}</div>`:""}</div>`);
  $$("#out .res").forEach(c=>{if(c.querySelector(".ext"))return;const h=r.results.find(x=>x.id==c.dataset.id),n=Object.entries(h.needs),[ic,lb]=FB[h.badge],inc=Math.max(0,...n.map(([k,v])=>v.reported-v.effective)),alt=r.results.find(x=>x.id!=h.id&&x.full_match&&x.risk!="HIGH");
   c.children[1].insertAdjacentHTML("beforeend",`<div class="ext"><span class="fb ${h.badge}">${ic} ${lb} · ${h.oldest_min} min old</span>${n.map(([k,v])=>`<div class="ln">${k}: about <b>${v.likely_free}</b> bed${v.likely_free==1?"":"s"} likely free <span class="m">(range ${v.low}–${v.high}, confidence ${v.confidence}%)</span></div>`).join("")}
   <div class="bda"><b>Bed at arrival</b><div class="m">Now: ${n.map(([k,v])=>k+" "+v.reported).join(" · ")} · ETA ${h.eta_min} min · Incoming ambulances: ${inc} · Predicted: <b>${h.at_arrival}%</b></div>${h.risk=="HIGH"?`<div class="hi">⚠ High risk of bed unavailability at arrival${alt?`. Suggested instead: ${alt.name} (${alt.eta_min} min, ${alt.at_arrival}%)`:""}</div>`:`<div class="ok2">● ${h.risk} risk</div>`}</div></div>`)})};
 new MutationObserver(deco).observe($("#out"),{childList:true})};
/* ---- ADMIN: interactive bed update ---- */
const _a=admin;admin=async function(){await _a();const h=H.find(x=>x.id==hid);if(!h||!$(".bed"))return;
 let last=Date.now()-age(h)*60000;$(".card").insertAdjacentHTML("afterbegin",'<div id="fp" class="fp"></div>');
 const paint=()=>{const m=Math.floor((Date.now()-last)/60000),b=m<10?"green":m<=30?"yellow":"red",[ic,lb]=FB[b];$("#fp").innerHTML=`<span class="fb ${b}">${ic} ${lb}</span> ${m<1?"Updated just now":"Updated "+m+" min ago"}. Dispatchers trust these numbers about <b>${Math.round(100*Math.exp(-.025*m))}%</b>. Tap + / − or confirm to keep them fresh.`};
 paint();tm.push(setInterval(()=>$("#fp")&&paint(),10000));
 $$(".bed button").forEach(b=>{const x=b.cloneNode(true);b.replaceWith(x);x.onclick=async()=>{const n=x.parentElement.querySelector(".n"),cur=+n.textContent,nv=Math.max(0,cur+ +x.dataset.d);if(nv==cur)return;
  n.textContent=nv;n.classList.add("pulse");setTimeout(()=>n.classList.remove("pulse"),300);last=Date.now();paint();
  const r=await j("/api/beds/"+hid,"POST",{bed_type:x.dataset.t,delta:+x.dataset.d});toast(r&&r.count!=null?`✓ ${x.dataset.t} now ${r.count}. Dispatchers see it live.`:"Could not save. Check connection.")}});
 const c=$("#cf"),c2=c.cloneNode(true);c.replaceWith(c2);c2.onclick=async()=>{await j(`/api/beds/${hid}/confirm`,"POST");last=Date.now();paint();toast("✓ Confirmed: still accurate")}};
/* ---- HOSPITAL ER: heads-up with timeline, arrival time, live map ---- */
const _e=er;er=async function(){await _e();const HH=await j("/api/hospitals"),me=Array.isArray(HH)&&HH.find(x=>x.id==hid);$("#inc").insertAdjacentHTML("afterend",'<div id="hu"></div>');const M={};
 every(async()=>{const Ls=await j(`/api/hospitals/${hid}/offers`);if(!Array.isArray(Ls)||!$("#hu"))return;
  $$("#hu>.card").forEach(c=>{if(!Ls.find(q=>"hq"+q.id==c.id))c.remove()});
  Ls.forEach(q=>{let c=document.getElementById("hq"+q.id);if(!c){$("#hu").insertAdjacentHTML("beforeend",`<div class="card" id="hq${q.id}"><b>Heads-up · request ${q.id}</b><div class="hl"></div><div class="htl"></div><div class="mini" style="display:none"></div></div>`);c=document.getElementById("hq"+q.id)}
   const held=q.status=="HELD"&&q.ambulance;c.querySelector(".hl").innerHTML=`<p style="margin:6px 0"><b>Patient condition:</b> ${q.condition||"not given"} · needs ${q.needs.join(" + ")}</p>`+(held?`<p style="margin:6px 0"><b>Ambulance arrives:</b> about ${clk(q.eta_at)} (in ${q.ambulance.eta_min} min) · <span class="m">live ${q.ambulance.lat.toFixed(4)}, ${q.ambulance.lng.toFixed(4)}</span></p><p class="m" style="margin:6px 0">ER team: prepare ${q.needs.join(" + ")} now.</p>`:`<p class="m" style="margin:6px 0">Accept to hold the bed and see live ambulance tracking.</p>`);
   c.querySelector(".htl").innerHTML=tl(q);
   if(held&&me&&typeof L!=="undefined"){const el=c.querySelector(".mini");el.style.display="";if(!M[q.id]){const m=L.map(el,{zoomControl:false}).setView([me.lat,me.lng],13);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18}).addTo(m);L.circleMarker([me.lat,me.lng],{radius:9,color:"#0b4f4a",fillOpacity:.9}).addTo(m).bindTooltip("Your hospital");
     M[q.id]={m,a:L.marker([q.ambulance.lat,q.ambulance.lng],{icon:L.divIcon({className:"",html:'<div class="amb">🚑</div>',iconSize:[36,36]})}).addTo(m)};setTimeout(()=>M[q.id].m.invalidateSize(),200)}
    M[q.id].a.setLatLng([q.ambulance.lat,q.ambulance.lng]);M[q.id].m.fitBounds([[me.lat,me.lng],[q.ambulance.lat,q.ambulance.lng]],{padding:[30,30],maxZoom:15})}})},2000)};
})();

/* ===== v10 command-center dashboard (replaces dash(); find/live/ER/admin unchanged) ===== */
(function(){
const $$=(s,r=document)=>[...r.querySelectorAll(s)],FBL={green:"FRESH",yellow:"AGING",red:"STALE"},STEPS=["NEW REQUEST","MATCHING","CONTACTED","WAITING","ACCEPTED","RESERVED","EN ROUTE","ARRIVED"];
let LR=null,flt="ALL",qs="",fr=false,seen=0,route=null,rcache="",rad=null,demoOn=false,lastRid=null,evs=new Set();
function tw(id,to){const e=document.getElementById(id);if(!e)return;const from=+e.dataset.v||0;e.dataset.v=to;if(from==to){e.textContent=to;return}
 const t0=performance.now(),d=e.parentElement.querySelector(".dl");if(d){d.textContent=to>from?"↑":"↓";d.style.opacity=1;setTimeout(()=>d.style.opacity=0,2000)}
 const f=n=>{const p=Math.min(1,(n-t0)/500);e.textContent=Math.round(from+(to-from)*p);if(p<1)requestAnimationFrame(f)};requestAnimationFrame(f)}
const donut=v=>{const tot=v.reduce((a,b)=>a+b,0)||1,C=163.4;let o=0;return `<svg width="62" height="62" viewBox="0 0 64 64">${v.map((n,i)=>{const l=C*n/tot,s=`<circle cx="32" cy="32" r="26" fill="none" stroke="${["#1b8a5a","#d99a00","#d7263d"][i]}" stroke-width="9" stroke-dasharray="${l} ${C-l}" stroke-dashoffset="${-o}" transform="rotate(-90 32 32)"/>`;o+=l;return s}).join("")}</svg>`};
const cf=m=>Math.round(100*Math.exp(-.025*m));
function drawer(h){const r=LR&&LR.results.find(x=>x.id==h.id),a=age(h),b=bd(a),d=$("#dr");
 d.innerHTML=`<button class="x" id="dx" aria-label="Close">✕</button><h2>${h.name}</h2><div class="m">${h.beds.ICU.count>0?"● ACCEPTING":"● LIMITED"}${r?` · ${r.dist_km} km · ${r.eta_min} min ETA`:""}</div>
 <h4>BED CAPACITY (available now)</h4>${T.map(t=>{const n=h.beds[t].count;return `<div class="cap"><span>${t}</span><div class="bar"><i style="width:${Math.min(100,n*10)}%;background:var(--teal)"></i></div><b>${n}</b></div>`}).join("")}
 <h4>SPECIALTIES</h4><div class="tags">${["Cardiac","Trauma","Burns","Stroke","NICU"].map(t=>{const ok=h.beds[t]&&h.beds[t].count>0;return `<span class="tg ${ok?"y":"n"}">${ok?"✓":"✕"} ${t}</span>`}).join("")}</div>
 <h4>DATA QUALITY</h4><span class="fb ${b}">${FBL[b]} · ${a} min ago</span> <b>${cf(a)}%</b> confidence<div class="bar" style="margin:6px 0"><i style="width:${cf(a)}%;background:${COL[b]}"></i></div><p class="m">Availability confidence decreases as time since the last hospital update increases.</p>
 ${r?`<h4>ARRIVAL PREDICTION</h4><div class="${r.risk=="HIGH"?"warn":""}"><b>${r.risk=="HIGH"?"⚠ HIGH RISK: bed may become unavailable before arrival":"● "+r.risk+" RISK"}</b> · ${r.at_arrival}% at arrival</div>`:""}
 <button class="btn" id="dq">Find bed for this patient</button><button class="btn alt" id="dv">View on map</button>`;d.classList.add("on");
 $("#dx").onclick=()=>d.classList.remove("on");$("#dv").onclick=()=>map.flyTo([h.lat,h.lng],15);$("#dq").onclick=()=>{d.classList.remove("on");$("#go")?.click()}}
const listEm=RQ=>{const d=$("#dr");d.innerHTML=`<button class="x" id="dx">✕</button><h2>Active emergencies</h2>`+(RQ.length?RQ.map(q=>`<div class="card"><b>${q.needs.join(" + ")}</b> <span class="m">#${q.id}</span><div>${q.condition||"no note"} · ${q.status}</div>${tl(q)}</div>`).join(""):'<p class="m">None right now. Press Run live demo to see one.</p>');d.classList.add("on");$("#dx").onclick=()=>d.classList.remove("on")};
dash=function(){
 if(typeof L==="undefined"){app.innerHTML='<div class="page"><div class="card warn">Map library failed to load. Check your internet and refresh.</div></div>';return}
 LR=null;seen=0;lastRid=null;route=null;rcache="";rad=null;
 const ST=[["em","ACTIVE EMERGENCIES"],["ic","ICU BEDS"],["vt","VENTILATORS"],["en","AMBULANCES EN ROUTE"],["wt","AWAITING HOSPITAL"]];
 app.innerHTML=`<section class="dash"><div class="mapwrap"><div id="map"></div>
 <div class="strip">${ST.map(([k,l])=>`<div class="st" data-k="${k}"><b id="s_${k}">0</b><span>${l}</span><i class="dl"></i></div>`).join("")}<button id="demo">▶ RUN LIVE DEMO</button></div>
 <div class="ft" id="ft"></div><div id="fo"></div><div id="dm"></div>
 <div id="bar">${["ALL",...T,"FRESH ONLY"].map(t=>`<button class="chip ${t==flt?"on":""}" data-f="${t}">${t}</button>`).join("")}<input type="text" id="sq" placeholder="Search hospital, area or ICU…"></div>
 <div class="feed" id="feed"></div><div id="stp"></div><div id="dr"></div></div><aside id="side"></aside></section>`;
 map=L.map("map",{zoomControl:false}).setView([19.07,72.86],12);L.control.zoom({position:"topleft"}).addTo(map);
 L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(map);setTimeout(()=>map&&map.invalidateSize(),250);
 pick=L.marker([19.076,72.8777],{draggable:true,zIndexOffset:900,icon:L.divIcon({className:"",html:'<div class="pickup"></div>',iconSize:[22,22]})}).addTo(map).bindTooltip("🚑 A-102 · patient pickup (drag me)",{permanent:true,direction:"top",offset:[0,-12]});
 rad=L.circle(pick.getLatLng(),{radius:10000,color:"#6d4aff",weight:1,fillOpacity:.04,dashArray:"4 6"}).addTo(map);
 const setF=f=>{flt=f;$$("#bar [data-f]").forEach(c=>c.classList.toggle("on",c.dataset.f==f));refresh()};
 $$("#bar [data-f]").forEach(c=>c.onclick=()=>setF(c.dataset.f));$("#sq").oninput=e=>{qs=e.target.value.toLowerCase();refresh(true)};
 $$(".st").forEach(s=>s.onclick=()=>{const k=s.dataset.k;k=="ic"?setF("ICU"):k=="vt"?setF("Ventilator"):listEm(window.__RQ||[])});
 $("#demo").onclick=demo;pick.on("dragend",()=>refresh());
 const refresh=async focus=>{const HH=await j("/api/hospitals");if(!map)return;if(!Array.isArray(HH)){$("#feed").innerHTML="<b>Cannot reach server</b>Is uvicorn running?";return}H=HH;
  const [RQ,LG]=await Promise.all([j("/api/requests"),j("/api/log?limit=6")]),pp=pick.getLatLng();if(!map)return;window.__RQ=RQ.filter(q=>["OFFERED","HELD"].includes(q.status));rad.setLatLng(pp);
  if(needs.size)LR=await j("/api/rank","POST",{needs:[...needs],lat:pp.lat,lng:pp.lng});if(!map)return;
  const best=LR&&LR.results[0],bid=best&&best.id,R=id=>LR&&LR.results.find(x=>x.id==id),Q=rid?RQ.find(q=>q.id==rid):null;
  H.forEach(h=>{const a=age(h),t=flt=="ALL"||flt=="FRESH ONLY"?"ICU":flt,n=h.beds[t]?h.beds[t].count:0,r=R(h.id),pu=h.id==bid&&!(LR&&LR.partial_mode&&0),
   dim=(flt!="ALL"&&flt!="FRESH ONLY"&&n==0)||(flt=="FRESH ONLY"&&a>=10)||(qs&&!(h.name.toLowerCase().includes(qs)||qs=="icu"&&h.beds.ICU.count>0)),
   c=pu?"#6d4aff":n==0?"#d7263d":(a>=10||n<=1)?"#d99a00":"#1b8a5a",
   ic=L.divIcon({className:"",html:`<div class="mk ${pu?"pu":""} ${dim?"dim":""}" style="--c:${c}">${n}</div>`,iconSize:[40,40],iconAnchor:[20,20]}),
   tip=`<b>${h.name}</b><br>🛏 ICU ${h.beds.ICU.count} · 🫁 Vent ${h.beds.Ventilator.count}<br>● ${FBL[bd(a)]} · ${a} min ago${r?`<br>ETA ${r.eta_min} min · match ${Math.round(r.score*100)}%${pu?" · ★ BEST MATCH":""}`:""}`;
   if(mk[h.id])mk[h.id].setIcon(ic).setTooltipContent(tip);else{mk[h.id]=L.marker([h.lat,h.lng],{icon:ic}).addTo(map).bindTooltip(tip,{direction:"top",offset:[0,-18]});mk[h.id].on("click",()=>drawer(H.find(x=>x.id==h.id)))}});
  if(focus&&qs){const m=H.find(h=>h.name.toLowerCase().includes(qs));if(m)map.flyTo([m.lat,m.lng],14)}
  const s=t=>H.reduce((x,h)=>x+h.beds[t].count,0),V={em:window.__RQ.length,ic:s("ICU"),vt:s("Ventilator"),en:RQ.filter(q=>q.status=="HELD").length,wt:RQ.filter(q=>q.status=="OFFERED").length};
  Object.entries(V).forEach(([k,v])=>tw("s_"+k,v));$(".st[data-k=em]").classList.toggle("hot",V.em>0);
  const ag=H.map(age),fc=[ag.filter(a=>a<10).length,ag.filter(a=>a>=10&&a<=30).length,ag.filter(a=>a>30).length],avg=Math.round(ag.reduce((x,a)=>x+cf(a),0)/ag.length),fm=LR?LR.results.filter(x=>x.full_match):[],rk=["LOW","MEDIUM","HIGH"].map(k=>fm.filter(x=>x.risk==k).length),mx=Math.max(1,...rk);
  $("#ft").innerHTML=`<div class="f1">${donut(fc)}<div><h5>① IS THIS DATA STILL TRUE?</h5><span style="color:#1b8a5a">● ${fc[0]} fresh</span> <span style="color:#d99a00">● ${fc[1]} old</span> <span style="color:#d7263d">● ${fc[2]} very old</span><br>Avg confidence <b>${avg}%</b></div></div>
   <div class="f2"><h5>② BEST MATCH ★</h5>${best?`<div class="big">${Math.round(best.score*100)}%</div><b>${best.name.split(",")[0]}</b><br>${best.eta_min} min · ${best.dist_km} km · conf ${Math.min(...Object.values(best.needs).map(v=>v.confidence))}%`:"Pick beds to rank"}</div>
   <div class="f3"><h5>③ BED AT ARRIVAL</h5>${["LOW","MED","HIGH"].map((k,i)=>`<div class="rk"><span>${k}</span><div class="bar"><i style="width:${100*rk[i]/mx}%;background:${["#1b8a5a","#d99a00","#d7263d"][i]}"></i></div><b>${rk[i]}</b></div>`).join("")}</div>
   <div class="f4"><h5>④ MATCH MODE</h5>${LR&&LR.partial_mode?`<b class="warn">Partial match</b><br>missing: ${best.missing.join(", ")}<br>Stabilise: ${LR.nearest_stabilise?LR.nearest_stabilise.name.split(",")[0]:"-"}`:`<b style="color:#1b8a5a">Perfect match found</b><br>${fm.length} hospitals have every bed`}</div>
   <div class="f5"><h5>⑤ 2-MIN FAILOVER</h5>${Q?`<b>${Q.offers.length} contacted</b><br>${Q.status=="OFFERED"?"waiting on "+Q.offers[Q.offers.length-1].name.split(",")[0]:Q.status}`:"Standby<br><span class='m'>no reply in 2 min → next hospital</span>"}</div>`;
  const si=!Q?-1:Q.status=="OFFERED"?3:Q.status=="EXHAUSTED"?3:(Q.ambulance&&Q.ambulance.eta_min>0)?6:7;
  $("#stp").innerHTML=STEPS.map((x,i)=>`<div class="sp ${Q&&Q.status=="EXHAUSTED"&&i==3?"bad":i<si?"dn":i==si?"cu":""}"><i>${i<si?"✓":i==si?"●":"○"}</i>${x}</div>`).join("");
  if(rid!=lastRid){lastRid=rid;seen=0}
  if(Q){const bad=Q.offers.filter(o=>["timeout","rejected"].includes(o.status));if(bad.length>seen){const o=bad[bad.length-1],nx=Q.offers[Q.offers.length-1],fo=$("#fo");seen=bad.length;
    fo.innerHTML=`<b>⚠ HOSPITAL RESPONSE ${o.status=="timeout"?"TIMEOUT":"REJECTED"}</b>${o.name} ${o.status=="timeout"?"did not respond within the response window":"declined the request"}. BedLink is automatically contacting ${nx.status=="offered"?nx.name:"the next suitable hospital"}.`;fo.style.display="block";setTimeout(()=>fo.style.display="none",9000)}}
  if(!rid&&bid){const b=H.find(h=>h.id==bid),key=`${pp.lat.toFixed(3)},${pp.lng.toFixed(3)}>${bid}`;if(key!=rcache){rcache=key;let pts=[[pp.lat,pp.lng],[b.lat,b.lng]];
    try{const r=await(await fetch(`https://router.project-osrm.org/route/v1/driving/${pp.lng},${pp.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`)).json();pts=r.routes[0].geometry.coordinates.map(c=>[c[1],c[0]])}catch(e){}
    if(!map)return;route&&route.remove();route=L.polyline(pts,{color:"#6d4aff",weight:4,className:"route"}).addTo(map)}}
  if(rid&&route){route.remove();route=null;rcache=""}
  const nm=id=>(H.find(h=>h.id==id)?.name||"").split(",")[0],ev=[...RQ.flatMap(q=>q.offers.map(o=>({k:q.id+o.hid+o.status,t:o.offered_at,m:`${nm(o.hid)}: ${o.status} (#${q.id})`}))),...LG.map(l=>({k:"l"+l.id,t:l.ts,m:`${nm(l.hospital_id)} ${l.bed_type} ${l.old_count}→${l.new_count}`}))].sort((a,b)=>b.t-a.t).slice(0,6);
  $("#feed").innerHTML="<b>LIVE ACTIVITY</b>"+ev.map(e=>{const n=!evs.has(e.k);evs.add(e.k);return `<div class="${n?"ev":""}">● ${new Date(e.t*1000).toLocaleTimeString()} · ${e.m}</div>`}).join("");
  $("#lv").textContent="Live · "+new Date().toLocaleTimeString()};
 every(refresh,5000);tm.push(setInterval(()=>rid&&refresh(),1500));rid?live():find();
};
async function demo(){if(demoOn)return;demoOn=true;const cap=t=>{const d=$("#dm");d.textContent=t;d.style.display=t?"block":"none"},w=ms=>new Promise(r=>setTimeout(r,ms));
 try{rid=null;amb?.remove();rt?.remove();amb=rt=null;find();
  cap("Scene 1/8 · New critical emergency in Andheri. Ambulance A-102 dispatched.");pick.setLatLng([19.1197,72.8468]);map.flyTo([19.1197,72.8468],13);$("#cond").value="Critical trauma";needs=new Set(["ICU","Ventilator"]);$$(".chip[data-n]").forEach(c=>c.classList.toggle("on",needs.has(c.dataset.n)));await w(3000);
  cap("Scene 2/8 · Patient needs ICU + Ventilator. Ranking hospitals…");$("#go").click();await w(3500);
  cap("Scene 3/8 · Best match highlighted. Sending request…");await w(2500);$("[data-send]").click();await w(2000);
  cap("Scene 4/8 · 2-minute response window started (demo shortens the wait).");await w(8000);
  cap("Scene 5/8 · Hospital A did not reply. Automatic failover to the next hospital.");await j(`/api/demo/respond/${rid}?timeout=true`,"POST");await w(5000);
  cap("Scene 6/8 · Hospital B accepted. Bed reserved. ER team notified.");await j(`/api/demo/respond/${rid}?accept=true`,"POST");await w(6000);
  cap("Scene 7/8 · Ambulance en route. ER preparing ICU + ventilator.");await w(17000);
  cap("Scene 8/8 · ✓ ARRIVED. The bed was ready.");await w(5000)}catch(e){}finally{cap("");demoOn=false}}
})();
show(S?(S.role=="a"?"er":"dash"):"login");
