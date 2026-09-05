// JavaScript - FrigoPlan con tiempo real y Lista de la Compra

// Configuración opcional de Firebase Realtime Database
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "tu-app.firebaseapp.com",
    databaseURL: "https://tu-app-default-rtdb.firebaseio.com",
    projectId: "tu-app",
    storageBucket: "tu-app.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123def"
};

let db = null;
let useRealtime = false;

// Intentar inicializar Firebase si la configuración es válida
try {
    if (firebaseConfig.databaseURL && !firebaseConfig.databaseURL.includes("tu-app")) {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        useRealtime = true;
        document.getElementById('sync-status').innerHTML = '🟢 Sincronizado en Tiempo Real';
        document.getElementById('sync-status').style.background = 'rgba(76, 175, 80, 0.4)';
    }
} catch (e) {
    console.warn("Firebase no configurado, funcionando en modo localStorage.", e);
}

// Estado Local / Global
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
    planner: {},
    shoppingList: [
        { id: 'sh1', name: 'Pan de molde', checked: false },
        { id: 'sh2', name: 'Aceite de oliva', checked: false }
    ],
    weeklyLog: [],
    lastAutoDeductDate: ""
};

// Cargar estado inicial
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
    if (useRealtime) {
        db.ref('frigoplan_data').set(state);
    } else {
        localStorage.setItem('frigoplan_state', JSON.stringify(state));
    }
    renderAll();
}

function renderAll() {
    renderMainSummary();
    renderFreezer();
    renderPlanner();
    renderRecipes();
    renderShoppingList();
}

// --- LISTA DE LA COMPRA ---
function renderShoppingList() {
    const container = document.getElementById('shopping-list-container');
    const emptyMsg = document.getElementById('empty-shopping-msg');
    const badge = document.getElementById('shopping-count');
    
    badge.innerText = state.shoppingList.length;
    container.innerHTML = '';

    if (state.shoppingList.length === 0) {
        emptyMsg.classList.remove('hidden');
        return;
    }
    emptyMsg.classList.add('hidden');

    state.shoppingList.forEach(item => {
        const div = document.createElement('div');
        div.className = 'shopping-item-card';
        div.onclick = (e) => {
            if (e.target.tagName !== 'INPUT') {
                const checkbox = div.querySelector('input');
                checkbox.checked = !checkbox.checked;
                item.checked = checkbox.checked;
            } else {
                item.checked = e.target.checked;
            }
        };

        div.innerHTML = `
            <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleShoppingCheck('${item.id}', this.checked)">
            <span class="shopping-item-name" style="${item.checked ? 'text-decoration: line-through; color: #888;' : ''}">${item.name}</span>
        `;
        container.appendChild(div);
    });
}

function addShoppingItem(e) {
    e.preventDefault();
    const input = document.getElementById('shopping-input');
    const val = input.value.trim();
    if (!val) return;

    state.shoppingList.push({
        id: 'sh_' + Date.now(),
        name: val,
        checked: false
    });

    input.value = '';
    saveData();
}

function toggleShoppingCheck(id, checked) {
    const item = state.shoppingList.find(i => i.id === id);
    if (item) {
        item.checked = checked;
        saveData();
    }
}

function deleteSelectedShoppingItems() {
    const toDeleteCount = state.shoppingList.filter(i => i.checked).length;
    if (toDeleteCount === 0) {
        alert("Por favor, selecciona al menos un producto marcando la casilla antes de eliminar.");
        return;
    }
    
    state.shoppingList = state.shoppingList.filter(i => !i.checked);
    saveData();
}

// Interfaz e interacciones base
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.currentTarget.classList.add('active');
    document.getElementById('tab-' + tabId).classList.add('active');
}

function renderMainSummary() {
    document.getElementById('today-lunch').innerText = state.planner['lunes_comida'] || 'Sin planificar';
    document.getElementById('today-dinner').innerText = state.planner['lunes_cena'] || 'Sin planificar';
    document.getElementById('tomorrow-lunch').innerText = state.planner['martes_comida'] || 'Sin planificar';
    document.getElementById('tomorrow-dinner').innerText = state.planner['martes_cena'] || 'Sin planificar';
}

function renderFreezer() {
    const count = document.getElementById('freezer-count');
    count.innerText = state.stock.reduce((acc, i) => acc + i.servings, 0);
}

function renderPlanner() {}
function renderRecipes() {}

function openAddRecipeModal() { document.getElementById('add-recipe-modal').classList.add('active'); }
function closeAddRecipeModal() { document.getElementById('add-recipe-modal').classList.remove('active'); }
function openAddModal() { document.getElementById('add-modal').classList.add('active'); }
function closeAddModal() { document.getElementById('add-modal').classList.remove('active'); }
function openMainChangeModal(type) {
    document.getElementById('plan-day').value = 'lunes';
    document.getElementById('plan-type').value = type;
    document.getElementById('plan-modal').classList.add('active');
}
function closePlanModal() { document.getElementById('plan-modal').classList.remove('active'); }

document.addEventListener('DOMContentLoaded', init);
