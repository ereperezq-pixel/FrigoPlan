

const APP_VERSION = 'v6';
const UPDATE_SEEN_KEY = 'frigoplan_update_seen';

function showUpdateNoticeOnce(){
  if(localStorage.getItem(UPDATE_SEEN_KEY) === APP_VERSION) return;
  let modal=document.getElementById('update-modal');
  if(!modal) return;
  modal.classList.add('active');
}

function closeUpdateNotice(){
  localStorage.setItem(UPDATE_SEEN_KEY, APP_VERSION);
  const modal=document.getElementById('update-modal');
  if(modal) modal.classList.remove('active');
}

async function activateAppUpdate(){
  localStorage.setItem(UPDATE_SEEN_KEY, APP_VERSION);
  try{
    const reg = await navigator.serviceWorker.getRegistration();
    if(reg && reg.waiting){
      reg.waiting.postMessage({type:'SKIP_WAITING'});
      return;
    }
  }catch(e){ console.warn('No se pudo activar la actualización',e); }
  location.reload();
}

function setupUpdateDetection(){
  if(!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then(reg=>{
    reg.update().catch(()=>{});
    if(reg.waiting) showUpdateNoticeOnce();
    reg.addEventListener('updatefound',()=>{
      const worker=reg.installing;
      if(!worker) return;
      worker.addEventListener('statechange',()=>{
        if(worker.state==='installed' && navigator.serviceWorker.controller) showUpdateNoticeOnce();
      });
    });
  }).catch(err=>console.warn('Service Worker no disponible',err));
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(!window.__frigoplanReloaded){
      window.__frigoplanReloaded=true;
      location.reload();
    }
  });
}

const defaultState = {
    recipes: [
        { id: '1', name: 'Alubias', category: 'Comida', freezable: true },
        { id: '2', name: 'Lentejas', category: 'Comida', freezable: true },
        { id: '3', name: 'Macarrones', category: 'Comida', freezable: false },
        { id: '4', name: 'Tortilla Francesa', category: 'Cena', freezable: false }
    ],
    stock: [
        { id: 's1', name: 'Alubias', servings: 2 },
        { id: 's2', name: 'Lentejas', servings: 2 }
    ],
    planner: {
        // Estructura: { 'lunes_comida': { dish: 'Alubias', servings: 1 }, ... }
    },
    shoppingList: [
        { id: 'sh1', name: 'Huevos', checked: false }
    ]
};

const daysOfWeek = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const dayNamesMap = {
    'lunes': 'Lunes', 'martes': 'Martes', 'miércoles': 'Miércoles',
    'jueves': 'Jueves', 'viernes': 'Viernes', 'sábado': 'Sábado', 'domingo': 'Domingo'
};
const mealTypesMap = { 'comida': 'Comida', 'cena': 'Cena' };

let state = JSON.parse(JSON.stringify(defaultState));
let lastSavedState = JSON.parse(JSON.stringify(state));
const DEVICE_ID_KEY = 'frigoplan_device_id';
const DEVICE_NAME_KEY = 'frigoplan_device_name';
const DEVICE_ID = localStorage.getItem(DEVICE_ID_KEY) || ('dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
localStorage.setItem(DEVICE_ID_KEY, DEVICE_ID);

// Clave pública VAPID. La privada vive SOLO como secreto de la Edge Function de Supabase.
const PUSH_VAPID_PUBLIC_KEY = 'BJmMd5BZCmFjgJxJjLVse7eElU9s3ag0WlEgRgrOQDxol-HiprqtUW3Sxvwq4tmYZKp53HfqLRh54bbQp278NJg';

let collab = { client:null, channel:null, roomId:localStorage.getItem('frigoplan_room')||'', enabled:false, applyingRemote:false };

function getLocalConfig(){ const c=window.FRIGOPLAN_CONFIG||{}; return {url:(c.SUPABASE_URL||'').trim(),key:(c.SUPABASE_PUBLISHABLE_KEY||'').trim(),defaultRoom:(c.DEFAULT_ROOM||'').trim()}; }
function collabConfigured(){ const c=getLocalConfig(); return !!(window.supabase&&c.url&&!c.url.includes('TU-PROYECTO')&&c.key&&!c.key.includes('TU_PUBLISHABLE')); }
function setSyncStatus(type,text){ const e=document.getElementById('sync-status'); if(e){e.className='sync-status '+type;e.textContent=text;} }

async function initCollaboration(){
  if(!collabConfigured()){setSyncStatus('offline','● Solo local');return;}
  try{
    const c=getLocalConfig(); collab.client=window.supabase.createClient(c.url,c.key);
    const room=collab.roomId||c.defaultRoom;
    if(room){document.getElementById('collab-room').value=room;await connectCollaboration(room);}
    else setSyncStatus('offline','● Listo para conectar');
  }catch(e){console.error(e);setSyncStatus('error','● Error de conexión');}
}

async function connectCollaboration(roomArg){
  const input=document.getElementById('collab-room'), room=(roomArg||input.value||'').trim();
  if(!collabConfigured()){alert('Configura SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY en config.js.');return;}
  if(!room){if(input) input.focus();return;}
  saveCollabPreferences();
  try{
    if(!collab.client){const c=getLocalConfig();collab.client=window.supabase.createClient(c.url,c.key);}
    setSyncStatus('syncing','● Sincronizando...');
    if(collab.channel) await collab.client.removeChannel(collab.channel);
    collab.roomId=room;localStorage.setItem('frigoplan_room',room);
    const {data,error}=await collab.client.from('frigoplan_rooms').select('data').eq('room_id',room).maybeSingle();
    if(error) throw error;
    if(data&&data.data) applyRemoteState(data.data, true); else await pushSharedState('Sala creada y datos iniciales compartidos');
    collab.channel=collab.client.channel('frigoplan-'+room).on('postgres_changes',{event:'*',schema:'public',table:'frigoplan_rooms',filter:`room_id=eq.${room}`},p=>{
      if(p.new&&p.new.data&&!collab.applyingRemote) applyRemoteState(p.new.data);
    }).subscribe(status=>{
      if(status==='SUBSCRIBED'){collab.enabled=true;setSyncStatus('online','● Sincronizado');}
      if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){collab.enabled=false;setSyncStatus('error','● Sin conexión');}
    });
    document.getElementById('collab-state').textContent='Sala conectada. Los cambios se compartirán automáticamente.';
    updatePushButton();
    syncPushSubscriptionForRoom().catch(()=>{});
    closeModals();
  }catch(e){console.error(e);collab.enabled=false;setSyncStatus('error','● Error de sincronización');document.getElementById('collab-state').textContent='No se pudo conectar: '+(e.message||e);}
}

function cloneData(obj){
  try { return JSON.parse(JSON.stringify(obj)); } catch(e) { return obj; }
}

function getDeviceName(){
  return localStorage.getItem(DEVICE_NAME_KEY) || 'Otro dispositivo';
}

function setDeviceName(name){
  const clean=(name||'').trim().slice(0,40);
  if(clean) localStorage.setItem(DEVICE_NAME_KEY, clean);
}

function getChangeDescription(before, after){
  before=before||{}; after=after||{};
  const changes=[];
  const bStock=before.stock||[], aStock=after.stock||[];
  const byId=(arr)=>Object.fromEntries(arr.map(x=>[x.id,x]));
  const bs=byId(bStock), as=byId(aStock);
  for(const id of new Set([...Object.keys(bs),...Object.keys(as)])){
    const b=bs[id], a=as[id];
    if(!b&&a) changes.push(`Añadido al stock: ${a.name} (${a.servings} raciones)`);
    else if(b&&!a) changes.push(`Eliminado del stock: ${b.name}`);
    else if(b&&a&&b.servings!==a.servings) changes.push(`Stock de ${a.name}: ${b.servings} → ${a.servings} raciones`);
  }
  const bShop=before.shoppingList||[], aShop=after.shoppingList||[];
  const bsm=byId(bShop), asm=byId(aShop);
  for(const id of new Set([...Object.keys(bsm),...Object.keys(asm)])){
    const b=bsm[id], a=asm[id];
    if(!b&&a) changes.push(`Añadido a la compra: ${a.name}`);
    else if(b&&!a) changes.push(`Eliminado de la compra: ${b.name}`);
    else if(b&&a&&b.checked!==a.checked) changes.push(`${a.checked?'Comprado':'Pendiente'}: ${a.name}`);
  }
  if(JSON.stringify(before.planner||{})!==JSON.stringify(after.planner||{})) changes.push('Planificación semanal modificada');
  if(JSON.stringify(before.recipes||[])!==JSON.stringify(after.recipes||[])) changes.push('Recetas modificadas');
  return changes.length ? changes.slice(0,3).join(' · ') : 'Datos actualizados';
}

function urlBase64ToUint8Array(base64String){
  const padding='='.repeat((4-(base64String.length%4))%4);
  const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64); const out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i);
  return out;
}

async function getServiceWorkerRegistration(){
  if(!('serviceWorker' in navigator)) return null;
  try { return await navigator.serviceWorker.ready; } catch(e){ console.warn('Service Worker no disponible',e); return null; }
}

async function registerPushSubscription(showFeedback=true){
  try{
    if(!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)){
      if(showFeedback) alert('Este navegador no permite notificaciones push. En iPhone/iPad, instala FrigoPlan como app desde Safari para poder recibir avisos con la app cerrada.');
      return false;
    }
    if(!collab.client || !collab.roomId){
      if(showFeedback) alert('Primero conecta FrigoPlan a una sala.');
      return false;
    }
    const permission=Notification.permission==='granted' ? 'granted' : await Notification.requestPermission();
    if(permission!=='granted'){
      if(showFeedback) alert('No se ha concedido permiso para las notificaciones.');
      return false;
    }
    const reg=await getServiceWorkerRegistration();
    if(!reg) throw new Error('No se pudo obtener el Service Worker');
    let sub=await reg.pushManager.getSubscription();
    if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(PUSH_VAPID_PUBLIC_KEY)});
    const json=sub.toJSON();
    const {error}=await collab.client.from('frigoplan_push_subscriptions').upsert({
      endpoint:json.endpoint,
      room_id:collab.roomId,
      device_id:DEVICE_ID,
      device_name:getDeviceName(),
      subscription:json,
      updated_at:new Date().toISOString()
    },{onConflict:'endpoint'});
    if(error) throw error;
    localStorage.setItem('frigoplan_push_enabled','on');
    updatePushButton();
    if(showFeedback) alert('🔔 Avisos activados. Recibirás notificaciones aunque FrigoPlan esté cerrada.');
    return true;
  }catch(e){
    console.error('Error activando notificaciones push',e);
    if(showFeedback) alert('No se pudieron activar los avisos: '+(e.message||e));
    return false;
  }
}

async function disablePushSubscription(){
  try{
    const reg=await getServiceWorkerRegistration();
    const sub=reg&&await reg.pushManager.getSubscription();
    if(sub && collab.client){ await collab.client.from('frigoplan_push_subscriptions').delete().eq('endpoint',sub.endpoint); await sub.unsubscribe(); }
  }catch(e){ console.warn('No se pudo desactivar push',e); }
  localStorage.setItem('frigoplan_push_enabled','off'); updatePushButton();
}

function updatePushButton(){
  const b=document.getElementById('push-enable-btn');
  if(!b) return;
  const enabled=localStorage.getItem('frigoplan_push_enabled')==='on';
  b.textContent=enabled?'🔔 Avisos con la app cerrada: ACTIVADOS':'🔔 Activar avisos aunque la app esté cerrada';
}

async function syncPushSubscriptionForRoom(){
  if(localStorage.getItem('frigoplan_push_enabled')==='on' && 'Notification' in window && Notification.permission==='granted'){
    await registerPushSubscription(false);
  }
}

function notificationsEnabled(){ return localStorage.getItem('frigoplan_notifications') !== 'off'; }

function showRemoteNotification(message){
  let toast=document.getElementById('remote-toast');
  if(!toast){
    toast=document.createElement('div'); toast.id='remote-toast'; toast.className='remote-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML=`<strong>🔔 FrigoPlan</strong><span>${message}</span>`;
  toast.classList.add('show');
  clearTimeout(window.__frigoplanToastTimer);
  window.__frigoplanToastTimer=setTimeout(()=>toast.classList.remove('show'),6500);
  if(notificationsEnabled() && 'Notification' in window && Notification.permission==='granted'){
    try { new Notification('FrigoPlan', {body:message, icon:'./manifest.json'}); } catch(e) {}
  }
}

function requestChangeNotifications(){
  if(!notificationsEnabled() || !('Notification' in window)) return;
  if(Notification.permission==='default') Notification.requestPermission().catch(()=>{});
}

function saveCollabPreferences(){
  const name=document.getElementById('collab-device-name')?.value||'';
  setDeviceName(name);
  const enabled=document.getElementById('collab-notifications')?.checked!==false;
  localStorage.setItem('frigoplan_notifications', enabled?'on':'off');
  if(enabled) requestChangeNotifications();
}

async function pushSharedState(eventText='Datos actualizados'){
  if(!collab.client||!collab.roomId||collab.applyingRemote)return;
  setSyncStatus('syncing','● Guardando...');
  const payload={...state,_meta:{sourceId:DEVICE_ID,deviceName:getDeviceName(),event:eventText,ts:Date.now()}};
  const {error}=await collab.client.from('frigoplan_rooms').upsert({room_id:collab.roomId,data:payload,updated_at:new Date().toISOString()},{onConflict:'room_id'});
  if(error){setSyncStatus('error','● Error al guardar');throw error;}
  setSyncStatus('online','● Sincronizado');
}

function applyRemoteState(d, silent=false){
  if(!d||typeof d!=='object')return;
  const meta=d._meta||{};
  const isOtherDevice=meta.sourceId && meta.sourceId!==DEVICE_ID;
  const event=meta.event||'Datos actualizados';
  collab.applyingRemote=true;
  state.recipes=Array.isArray(d.recipes)?d.recipes:state.recipes;
  state.stock=Array.isArray(d.stock)?d.stock:state.stock;
  state.shoppingList=Array.isArray(d.shoppingList)?d.shoppingList:state.shoppingList;
  state.planner=d.planner&&typeof d.planner==='object'?d.planner:state.planner;
  localStorage.setItem('frigoplan_v3',JSON.stringify(state));
  lastSavedState=cloneData(state);
  renderAll();collab.applyingRemote=false;setSyncStatus('online','● Actualizado');
  if(isOtherDevice && !silent) showRemoteNotification(`${meta.deviceName||'Otro dispositivo'}: ${event}`);
  setTimeout(()=>setSyncStatus('online','● Sincronizado'),1200);
}

function openCollabModal(){
  const c=getLocalConfig();document.getElementById('collab-room').value=collab.roomId||c.defaultRoom||'';
  const nameInput=document.getElementById('collab-device-name'); if(nameInput) nameInput.value=getDeviceName()==='Otro dispositivo'?'':getDeviceName();
  const notifInput=document.getElementById('collab-notifications'); if(notifInput) notifInput.checked=notificationsEnabled();
  updatePushButton();
  document.getElementById('collab-state').textContent=collabConfigured()?'Introduce el mismo código en todos los dispositivos.':'Falta configurar Supabase en config.js.';
  document.getElementById('collab-modal').classList.add('active');
}
async function disconnectCollaboration(){
  if(collab.channel&&collab.client)await collab.client.removeChannel(collab.channel);
  collab.channel=null;collab.enabled=false;setSyncStatus('offline','● Solo local');closeModals();
}


async function init() {
    const local = localStorage.getItem('frigoplan_v3');
    if (local) {
        try {
            const parsed = JSON.parse(local);
            state.recipes = Array.isArray(parsed.recipes) ? parsed.recipes : defaultState.recipes;
            state.stock = Array.isArray(parsed.stock) ? parsed.stock : defaultState.stock;
            state.shoppingList = Array.isArray(parsed.shoppingList) ? parsed.shoppingList : defaultState.shoppingList;
            state.planner = {};
            if (parsed.planner) {
                for (let key in parsed.planner) {
                    let val = parsed.planner[key];
                    if (typeof val === 'string' && val) state.planner[key] = { dish: val, servings: 1 };
                    else if (val && typeof val === 'object' && val.dish) state.planner[key] = val;
                }
            }
        } catch(e) { console.error("Error al cargar datos",e); state=JSON.parse(JSON.stringify(defaultState)); }
    }
    lastSavedState = JSON.parse(JSON.stringify(state));
    renderAll();
    await initCollaboration();
    setTimeout(showUpdateNoticeOnce, 250);
    setupUpdateDetection();
    updatePushButton();
}

function saveData() {
    const eventText=getChangeDescription(lastSavedState,state);
    lastSavedState=cloneData(state);
    localStorage.setItem('frigoplan_v3', JSON.stringify(state));
    renderAll();
    if (collab.enabled && !collab.applyingRemote) pushSharedState(eventText).catch(()=>{});
}

function resetApp() {
    if(confirm("¿Borrar todos los datos y empezar de cero?")) {
        localStorage.removeItem('frigoplan_v3');
        state = JSON.parse(JSON.stringify(defaultState));
        saveData();
    }
}

function renderAll() {
    renderMainSummary(); 
    renderFreezer(); 
    renderPlanner(); 
    renderRecipes(); 
    renderShoppingList();
    checkGlobalStockAlerts();
}

// Cálculo del stock acumulado consumido por plato en la semana
function getConsumptionSummary() {
    let consumption = {}; // { 'Alubias': total_rations_planned }
    for (let key in state.planner) {
        let entry = state.planner[key];
        if (entry && entry.dish) {
            let dish = entry.dish;
            let qty = parseInt(entry.servings) || 1;
            consumption[dish] = (consumption[dish] || 0) + qty;
        }
    }
    return consumption;
}

// Valida si un plato se queda sin stock en algún día concreto y devuelve detalles
function getStockDeficits() {
    // Ordenamos los días cronológicamente
    let slotList = [];
    daysOfWeek.forEach(day => {
        ['comida', 'cena'].forEach(type => {
            slotList.push({ day, type, key: `${day}_${type}` });
        });
    });

    let runningStock = {};
    state.stock.forEach(s => {
        runningStock[s.name] = s.servings;
    });

    let deficits = []; // Lista de alertas detalladas

    slotList.forEach(slot => {
        let entry = state.planner[slot.key];
        if (entry && entry.dish) {
            let dish = entry.dish;
            let needed = parseInt(entry.servings) || 1;
            let currentStock = runningStock[dish] !== undefined ? runningStock[dish] : 0;

            if (needed > currentStock) {
                deficits.exports = true;
                deficits.push({
                    dish: dish,
                    day: dayNamesMap[slot.day],
                    mealType: mealTypesMap[slot.type],
                    available: Math.max(0, currentStock),
                    requested: needed
                });
                runningStock[dish] = 0; // Se agota
            } else {
                runningStock[dish] = currentStock - needed;
            }
        }
    });

    return deficits;
}

function checkGlobalStockAlerts() {
    const alertBox = document.getElementById('global-stock-alert');
    let deficits = getStockDeficits();

    if (deficits.length > 0) {
        let messages = deficits.map(d => 
            `⚠️ El plato <strong>${d.dish}</strong> planificado para el <strong>${d.day} (${d.mealType})</strong> no tiene suficiente stock (Disponibles: ${d.available}, Pedidas: ${d.requested}).`
        );
        alertBox.innerHTML = messages.join('<br>');
        alertBox.classList.remove('hidden');
    } else {
        alertBox.classList.add('hidden');
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.tab-btn[onclick*="${tabId}"]`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
}

function renderMainSummary() {
    let lLunch = state.planner['lunes_comida'];
    let lDinner = state.planner['lunes_cena'];
    
    document.getElementById('today-lunch').innerText = lLunch ? `${lLunch.dish} (${lLunch.servings} r.)` : 'Sin planificar';
    document.getElementById('today-dinner').innerText = lDinner ? `${lDinner.dish} (${lDinner.servings} r.)` : 'Sin planificar';
}

function renderFreezer() {
    const grid = document.getElementById('stock-grid');
    grid.innerHTML = '';
    const active = state.stock.filter(i => i.servings > 0);
    if(active.length === 0) {
        document.getElementById('empty-stock-msg').classList.remove('hidden'); return;
    }
    document.getElementById('empty-stock-msg').classList.add('hidden');
    
    let consumption = getConsumptionSummary();

    active.forEach(item => {
        let plannedForThis = consumption[item.name] || 0;
        let realRemaining = item.servings - plannedForThis;

        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <h3>🍲 ${item.name}</h3>
            <p style="margin: 6px 0; font-size:1.1rem;">Stock real: <strong>${item.servings} r.</strong></p>
            <p style="margin: 6px 0; font-size:0.9rem; color:#666;">Planificado semana: <strong>-${plannedForThis} r.</strong></p>
            <p style="margin: 6px 0; font-size:0.95rem; color:${realRemaining < 0 ? '#d32f2f' : '#2e7d32'};">Disponible neto: <strong>${realRemaining} r.</strong></p>
            <div style="display:flex; gap:8px; margin-top:10px;">
                <button class="btn btn-sm" style="background:#eee" onclick="adjustStock('${item.id}', -1)">-1</button>
                <button class="btn btn-sm" style="background:#eee" onclick="adjustStock('${item.id}', 1)">+1</button>
            </div>
        `;
        grid.appendChild(div);
    });
}

function adjustStock(id, diff) {
    const item = state.stock.find(i => i.id === id);
    if(item) { item.servings = Math.max(0, item.servings + diff); saveData(); }
}

function renderPlanner() {
    const container = document.getElementById('week-planner-container');
    container.innerHTML = '';
    
    let deficits = getStockDeficits();
    let deficitMap = {};
    deficits.forEach(d => {
        deficitMap[`${d.day}_${d.mealType}`] = true;
    });

    daysOfWeek.forEach(dayKey => {
        let dayName = dayNamesMap[dayKey];
        let lunchEntry = state.planner[`${dayKey}_comida`];
        let dinnerEntry = state.planner[`${dayKey}_cena`];

        let lunchText = lunchEntry ? `${lunchEntry.dish} (${lunchEntry.servings} r.)` : '- Vacío -';
        let dinnerText = dinnerEntry ? `${dinnerEntry.dish} (${dinnerEntry.servings} r.)` : '- Vacío -';

        let lunchHasDeficit = deficitMap[`${dayName}_Comida`] ? 'stock-warning' : '';
        let dinnerHasDeficit = deficitMap[`${dayName}_Cena`] ? 'stock-warning' : '';

        container.innerHTML += `
            <div class="planner-day-card">
                <h3>${dayName}</h3>
                <div class="planner-meals-grid">
                    <div class="meal-slot ${lunchHasDeficit}" onclick="openPlanModal('${dayKey}', 'comida')">
                        <small>☀️ Comida</small><div><strong>${lunchText}</strong></div>
                    </div>
                    <div class="meal-slot ${dinnerHasDeficit}" onclick="openPlanModal('${dayKey}', 'cena')">
                        <small>🌙 Cena</small><div><strong>${dinnerText}</strong></div>
                    </div>
                </div>
            </div>`;
    });
}

function renderRecipes() {
    const grid = document.getElementById('recipes-list');
    grid.innerHTML = '';
    state.recipes.forEach(r => {
        grid.innerHTML += `
            <div class="card">
                <h3>${r.name}</h3>
                <p>Categoría: ${r.category}</p>
                <p>${r.freezable ? '🧊 Se puede congelar' : '❌ No congelable'}</p>
            </div>`;
    });
}

function renderShoppingList() {
    const main = document.getElementById('shopping-list-main-preview');
    const tab = document.getElementById('shopping-list-container');
    main.innerHTML = ''; tab.innerHTML = '';
    
    state.shoppingList.forEach(item => {
        const html = `
            <div class="shopping-item-card" onclick="toggleShopping('${item.id}')">
                <input type="checkbox" ${item.checked ? 'checked' : ''} onclick="event.stopPropagation(); toggleShopping('${item.id}')">
                <span style="${item.checked ? 'text-decoration:line-through; color:#999' : ''}">${item.name}</span>
            </div>`;
        main.innerHTML += html;
        tab.innerHTML += html;
    });
}

function addShoppingItem(e) {
    e.preventDefault();
    const val = (document.getElementById('shopping-input-main').value || document.getElementById('shopping-input-tab').value).trim();
    if(val) {
        state.shoppingList.push({ id: 'sh_'+Date.now(), name: val, checked: false });
        document.getElementById('shopping-input-main').value = '';
        document.getElementById('shopping-input-tab').value = '';
        saveData();
    }
}

function toggleShopping(id) {
    const item = state.shoppingList.find(i => i.id === id);
    if(item) { item.checked = !item.checked; saveData(); }
}
function deleteSelectedShoppingItems() {
    state.shoppingList = state.shoppingList.filter(i => !i.checked); saveData();
}

function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }

function openMainChangeModal(type) { openPlanModal('lunes', type); }

function openPlanModal(day, type) {
    document.getElementById('plan-day').value = day; 
    document.getElementById('plan-type').value = type;
    
    const select = document.getElementById('plan-dish-select');
    select.innerHTML = '<option value="">- Vaciar / Sin planificar -</option>';
    state.recipes.forEach(r => { 
        select.innerHTML += `<option value="${r.name}">${r.name} ${r.freezable ? '🧊' : ''}</option>`; 
    });

    const currentEntry = state.planner[`${day}_${type}`];
    if (currentEntry) {
        select.value = currentEntry.dish;
        document.getElementById('plan-servings-input').value = currentEntry.servings || 1;
    } else {
        select.value = '';
        document.getElementById('plan-servings-input').value = 1;
    }

    updateModalWarningPreview();
    select.onchange = updateModalWarningPreview;
    document.getElementById('plan-servings-input').oninput = updateModalWarningPreview;

    document.getElementById('plan-modal').classList.add('active');
}

// Simula en tiempo real dentro del modal si habrá stock suficiente teniendo en cuenta el orden semanal
function updateModalWarningPreview() {
    const day = document.getElementById('plan-day').value;
    const type = document.getElementById('plan-type').value;
    const dish = document.getElementById('plan-dish-select').value;
    const servings = parseInt(document.getElementById('plan-servings-input').value) || 0;
    const warningBox = document.getElementById('plan-modal-warning');

    if (!dish || servings <= 0) {
        warningBox.classList.add('hidden');
        return;
    }

    // Copiamos temporalmente el planner actual aplicando este cambio simulado para ver si salta déficit
    let tempPlanner = JSON.parse(JSON.stringify(state.planner));
    if (dish === "") {
        delete tempPlanner[`${day}_${type}`];
    } else {
        tempPlanner[`${day}_${type}`] = { dish, servings };
    }

    // Comprobamos déficits con este planner temporal
    let slotList = [];
    daysOfWeek.forEach(d => {
        ['comida', 'cena'].forEach(t => {
            slotList.push({ day: d, type: t, key: `${d}_${t}` });
        });
    });

    let runningStock = {};
    state.stock.forEach(s => { runningStock[s.name] = s.servings; });

    let hasError = false;
    let errorMsg = "";

    for (let slot of slotList) {
        let entry = tempPlanner[slot.key];
        if (entry && entry.dish) {
            let curStock = runningStock[entry.dish] !== undefined ? runningStock[entry.dish] : 0;
            if (entry.servings > curStock) {
                if (slot.day === day && slot.type === type) {
                    hasError = true;
                    errorMsg = `⚠️ ¡Atención! Estás planificando ${entry.servings} raciones de ${entry.dish}, pero el stock disponible neto en ese momento es de solo ${Math.max(0, curStock)} raciones.`;
                }
                runningStock[entry.dish] = 0;
            } else {
                runningStock[entry.dish] = curStock - entry.servings;
            }
        }
    }

    if (hasError) {
        warningBox.innerHTML = errorMsg;
        warningBox.classList.remove('hidden');
    } else {
        warningBox.classList.add('hidden');
    }
}

function savePlannerChoice(e) {
    e.preventDefault();
    const day = document.getElementById('plan-day').value;
    const type = document.getElementById('plan-type').value;
    const dish = document.getElementById('plan-dish-select').value;
    const servings = parseInt(document.getElementById('plan-servings-input').value) || 1;
    const key = `${day}_${type}`;

    if (!dish) {
        delete state.planner[key];
    } else {
        state.planner[key] = { dish, servings };
    }
    saveData(); 
    closeModals();
}

function openAddRecipeModal() { document.getElementById('add-recipe-modal').classList.add('active'); }
function saveRecipeForm(e) {
    e.preventDefault();
    state.recipes.push({
        id: 'r_'+Date.now(),
        name: document.getElementById('recipe-name').value,
        category: document.getElementById('recipe-category').value,
        freezable: document.getElementById('recipe-freezable').checked
    });
    document.getElementById('recipe-name').value = ''; saveData(); closeModals();
}

function openAddModal() {
    const select = document.getElementById('dish-name'); select.innerHTML = '';
    state.recipes.filter(r => r.freezable).forEach(r => { select.innerHTML += `<option value="${r.name}">${r.name}</option>`; });
    if(select.innerHTML) document.getElementById('add-modal').classList.add('active');
    else alert("Primero necesitas crear recetas marcadas como 'congelables' en la pestaña Recetas.");
}
function saveStockForm(e) {
    e.preventDefault();
    const name = document.getElementById('dish-name').value;
    const servings = parseInt(document.getElementById('dish-servings').value);
    const existing = state.stock.find(s => s.name === name);
    if(existing) existing.servings += servings;
    else state.stock.push({ id: 's_'+Date.now(), name, servings });
    saveData(); closeModals();
}

document.addEventListener('DOMContentLoaded', init);
