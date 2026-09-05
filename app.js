
const firebaseConfig = {
    apiKey: "TU_API_KEY", authDomain: "tu-app.firebaseapp.com",
    databaseURL: "https://tu-app-default-rtdb.firebaseio.com",
    projectId: "tu-app", storageBucket: "tu-app.appspot.com",
    messagingSenderId: "123456789", appId: "1:123456789:web:abc123def"
};
let db = null; let useRealtime = false;
try {
    if (firebaseConfig.databaseURL && !firebaseConfig.databaseURL.includes("tu-app")) {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database(); useRealtime = true;
        document.getElementById('sync-status').innerHTML = '🟢 Sincronizado en Tiempo Real';
        document.getElementById('sync-status').style.background = 'rgba(76, 175, 80, 0.4)';
    }
} catch (e) { console.warn("Firebase no configurado, funcionando en modo local."); }

let state = {
    recipes: [
        { id: '1', name: 'Alubias', category: 'Comida', freezable: true },
        { id: '2', name: 'Lentejas', category: 'Comida', freezable: true },
        { id: '3', name: 'Arroz con Pollo', category: 'Comida', freezable: false },
        { id: '4', name: 'Pescado al Horno', category: 'Cena', freezable: false },
        { id: '5', name: 'Hamburguesas', category: 'Cena', freezable: false }
    ],
    stock: [
        { id: 's1', name: 'Alubias', category: 'Comida', servings: 4 },
        { id: 's2', name: 'Lentejas', category: 'Comida', servings: 2 }
    ],
    planner: {
        'lunes_comida': 'Alubias', 'lunes_cena': 'Pescado al Horno',
        'martes_comida': 'Lentejas', 'martes_cena': 'Hamburguesas'
    },
    shoppingList: [
        { id: 'sh1', name: 'Pan de molde', checked: false },
        { id: 'sh2', name: 'Aceite de oliva', checked: false }
    ]
};
const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function init() {
    if (useRealtime) {
        db.ref('frigoplan_data').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                state = data;
                if (!state.shoppingList) state.shoppingList = [];
                if (!state.recipes) state.recipes = [];
                if (!state.stock) state.stock = [];
                if (!state.planner) state.planner = {};
            }
            renderAll();
        });
    } else {
        const local = localStorage.getItem('frigoplan_state');
        if (local) {
            state = JSON.parse(local);
            if (!state.shoppingList) state.shoppingList = [];
        }
        renderAll();
    }
}

function saveData() {
    if (useRealtime) { db.ref('frigoplan_data').set(state); } 
    else { localStorage.setItem('frigoplan_state', JSON.stringify(state)); }
    renderAll();
}

function renderAll() {
    renderMainSummary(); renderFreezer(); renderPlanner(); renderRecipes(); renderShoppingList();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    const selectedBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(tabId));
    if (selectedBtn) selectedBtn.classList.add('active');
    const targetContent = document.getElementById('tab-' + tabId);
    if (targetContent) targetContent.classList.add('active');
}

function renderMainSummary() {
    document.getElementById('today-lunch').innerText = state.planner['lunes_comida'] || 'Sin planificar';
    document.getElementById('today-dinner').innerText = state.planner['lunes_cena'] || 'Sin planificar';
    document.getElementById('tomorrow-lunch').innerText = state.planner['martes_comida'] || 'Sin planificar';
    document.getElementById('tomorrow-dinner').innerText = state.planner['martes_cena'] || 'Sin planificar';
}

function renderFreezer() {
    const grid = document.getElementById('stock-grid');
    const emptyMsg = document.getElementById('empty-stock-msg');
    const badge = document.getElementById('freezer-count');
    const activeStock = state.stock.filter(item => item.servings > 0);
    badge.innerText = activeStock.reduce((acc, item) => acc + item.servings, 0);
    grid.innerHTML = '';
    if (activeStock.length === 0) { emptyMsg.classList.remove('hidden'); return; }
    emptyMsg.classList.add('hidden');
    activeStock.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <h3>🍲 ${item.name}</h3>
            <p style="margin: 8px 0;">Categoría: <strong>${item.category}</strong></p>
            <p style="font-size: 1.1rem;">Raciones: <strong>${item.servings}</strong></p>
            <div style="display:flex; gap:6px; margin-top:12px;">
                <button class="btn btn-primary btn-sm" onclick="adjustServings('${item.id}', -1)">-1 Ración</button>
                <button class="btn btn-secondary btn-sm" onclick="adjustServings('${item.id}', 1)">+1 Ración</button>
            </div>
        `;
        grid.appendChild(div);
    });
}

function adjustServings(id, change) {
    const item = state.stock.find(i => i.id === id);
    if (item) { item.servings = Math.max(0, item.servings + change); saveData(); }
}

function renderPlanner() {
    const container = document.getElementById('week-planner-container');
    container.innerHTML = '';
    daysOfWeek.forEach(day => {
        const dayKey = day.toLowerCase();
        const lunch = state.planner[`${dayKey}_comida`] || 'Sin planificar';
        const dinner = state.planner[`${dayKey}_cena`] || 'Sin planificar';
        const card = document.createElement('div');
        card.className = 'planner-day-card';
        card.innerHTML = `
            <h3>${day}</h3>
            <div class="planner-meals-grid">
                <div class="meal-slot" onclick="openPlanModal('${dayKey}', 'comida')">
                    <small>☀️ Comida</small><div><strong>${lunch}</strong></div>
                </div>
                <div class="meal-slot" onclick="openPlanModal('${dayKey}', 'cena')">
                    <small>🌙 Cena</small><div><strong>${dinner}</strong></div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderRecipes() {
    const container = document.getElementById('recipes-list');
    container.innerHTML = '';
    state.recipes.forEach(r => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <h3>📖 ${r.name}</h3>
            <p>Categoría: <strong>${r.category}</strong></p>
            <p>Congelable: <strong>${r.freezable ? 'Sí 🧊' : 'No'}</strong></p>
        `;
        container.appendChild(card);
    });
}

function renderShoppingList() {
    const mainPreview = document.getElementById('shopping-list-main-preview');
    const tabContainer = document.getElementById('shopping-list-container');
    const emptyMsg = document.getElementById('empty-shopping-msg');
    const badge = document.getElementById('shopping-count');
    badge.innerText = state.shoppingList.length;
    mainPreview.innerHTML = ''; tabContainer.innerHTML = '';
    if (state.shoppingList.length === 0) {
        emptyMsg.classList.remove('hidden');
        mainPreview.innerHTML = '<p style="color:#888; font-size:0.9rem;">La lista está vacía</p>';
        return;
    }
    emptyMsg.classList.add('hidden');
    state.shoppingList.forEach(item => {
        mainPreview.appendChild(createShoppingRow(item));
        tabContainer.appendChild(createShoppingRow(item));
    });
}

function createShoppingRow(item) {
    const div = document.createElement('div');
    div.className = 'shopping-item-card';
    div.onclick = (e) => {
        if (e.target.tagName !== 'INPUT') {
            const checkbox = div.querySelector('input');
            checkbox.checked = !checkbox.checked;
            toggleShoppingCheck(item.id, checkbox.checked);
        }
    };
    div.innerHTML = `
        <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleShoppingCheck('${item.id}', this.checked)">
        <span style="${item.checked ? 'text-decoration: line-through; color: #888;' : 'font-weight:600;'}">${item.name}</span>
    `;
    return div;
}

function addShoppingItem(e) {
    e.preventDefault();
    const inputMain = document.getElementById('shopping-input-main');
    const inputTab = document.getElementById('shopping-input-tab');
    const val = (inputMain && inputMain.value.trim()) || (inputTab && inputTab.value.trim());
    if (!val) return;
    state.shoppingList.push({ id: 'sh_' + Date.now(), name: val, checked: false });
    if (inputMain) inputMain.value = '';
    if (inputTab) inputTab.value = '';
    saveData();
}

function toggleShoppingCheck(id, checked) {
    const item = state.shoppingList.find(i => i.id === id);
    if (item) { item.checked = checked; saveData(); }
}

function deleteSelectedShoppingItems() {
    const toDeleteCount = state.shoppingList.filter(i => i.checked).length;
    if (toDeleteCount === 0) { alert("Selecciona primero los productos que deseas eliminar."); return; }
    state.shoppingList = state.shoppingList.filter(i => !i.checked);
    saveData();
}

function openMainChangeModal(type) { openPlanModal('lunes', type); }

function openPlanModal(day, type) {
    document.getElementById('plan-day').value = day;
    document.getElementById('plan-type').value = type;
    const select = document.getElementById('plan-dish-select');
    select.innerHTML = '<option value="">-- Seleccionar --</option>';
    state.recipes.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.name; opt.innerText = r.name + (r.freezable ? ' (Guiso)' : '');
        select.appendChild(opt);
    });
    document.getElementById('plan-modal').classList.add('active');
}

function closePlanModal() { document.getElementById('plan-modal').classList.remove('active'); }

function savePlannerChoice(e) {
    e.preventDefault();
    const day = document.getElementById('plan-day').value;
    const type = document.getElementById('plan-type').value;
    const choice = document.getElementById('plan-dish-select').value;
    if (choice) {
        state.planner[`${day}_${type}`] = choice; saveData(); closePlanModal();
    }
}

function openAddRecipeModal() { document.getElementById('add-recipe-modal').classList.add('active'); }
function closeAddRecipeModal() { document.getElementById('add-recipe-modal').classList.remove('active'); }

function saveRecipeForm(e) {
    e.preventDefault();
    const name = document.getElementById('recipe-name').value.trim();
    const category = document.getElementById('recipe-category').value;
    const freezable = document.getElementById('recipe-freezable').checked;
    if (name) {
        state.recipes.push({ id: 'r_' + Date.now(), name, category, freezable });
        document.getElementById('recipe-name').value = ''; saveData(); closeAddRecipeModal();
    }
}

function openAddModal() { updateDishOptions(); document.getElementById('add-modal').classList.add('active'); }
function closeAddModal() { document.getElementById('add-modal').classList.remove('active'); }

function updateDishOptions() {
    const select = document.getElementById('dish-name'); select.innerHTML = '';
    const available = state.recipes.filter(r => r.freezable);
    available.forEach(r => {
        const opt = document.createElement('option'); opt.value = r.name; opt.innerText = r.name;
        select.appendChild(opt);
    });
}

function saveStockForm(e) {
    e.preventDefault();
    const name = document.getElementById('dish-name').value;
    const category = document.getElementById('dish-category').value;
    const servings = parseInt(document.getElementById('dish-servings').value, 10);
    if (name && servings > 0) {
        const existing = state.stock.find(s => s.name.toLowerCase() === name.toLowerCase());
        if (existing) { existing.servings += servings; } 
        else { state.stock.push({ id: 's_' + Date.now(), name, category, servings }); }
        saveData(); closeAddModal();
    }
}
document.addEventListener('DOMContentLoaded', init);
