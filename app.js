
// ESTADO POR DEFECTO A PRUEBA DE FALLOS
const defaultState = {
    recipes: [
        { id: '1', name: 'Alubias', category: 'Comida', freezable: true },
        { id: '2', name: 'Lentejas', category: 'Comida', freezable: true },
        { id: '3', name: 'Macarrones', category: 'Comida', freezable: false },
        { id: '4', name: 'Tortilla Francesa', category: 'Cena', freezable: false }
    ],
    stock: [
        { id: 's1', name: 'Alubias', servings: 4 },
        { id: 's2', name: 'Lentejas', servings: 2 }
    ],
    planner: {
        'lunes_comida': 'Alubias', 'lunes_cena': 'Tortilla Francesa'
    },
    shoppingList: [
        { id: 'sh1', name: 'Huevos', checked: false }
    ]
};

let state = JSON.parse(JSON.stringify(defaultState));

function init() {
    const local = localStorage.getItem('frigoplan_v2'); // Nueva clave para evitar conflictos pasados
    if (local) {
        try {
            const parsed = JSON.parse(local);
            // Asignación segura con fallback para evitar arrays rotos (causa del problema anterior)
            state.recipes = Array.isArray(parsed.recipes) ? parsed.recipes : defaultState.recipes;
            state.stock = Array.isArray(parsed.stock) ? parsed.stock : defaultState.stock;
            state.planner = parsed.planner || defaultState.planner;
            state.shoppingList = Array.isArray(parsed.shoppingList) ? parsed.shoppingList : defaultState.shoppingList;
        } catch(e) {
            console.error("Datos corruptos, cargando defecto.");
            state = JSON.parse(JSON.stringify(defaultState));
        }
    }
    renderAll();
}

function saveData() {
    localStorage.setItem('frigoplan_v2', JSON.stringify(state));
    renderAll();
}

function resetApp() {
    if(confirm("¿Borrar todos los datos y empezar de cero?")) {
        localStorage.removeItem('frigoplan_v2');
        localStorage.removeItem('frigoplan_state'); // Limpiar la versión vieja por si acaso
        state = JSON.parse(JSON.stringify(defaultState));
        saveData();
    }
}

function renderAll() {
    renderMainSummary(); renderFreezer(); renderPlanner(); renderRecipes(); renderShoppingList();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.tab-btn[onclick*="${tabId}"]`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
}

function renderMainSummary() {
    document.getElementById('today-lunch').innerText = state.planner['lunes_comida'] || 'Sin planificar';
    document.getElementById('today-dinner').innerText = state.planner['lunes_cena'] || 'Sin planificar';
}

function renderFreezer() {
    const grid = document.getElementById('stock-grid');
    grid.innerHTML = '';
    const active = state.stock.filter(i => i.servings > 0);
    if(active.length === 0) {
        document.getElementById('empty-stock-msg').classList.remove('hidden'); return;
    }
    document.getElementById('empty-stock-msg').classList.add('hidden');
    
    active.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <h3>🍲 ${item.name}</h3>
            <p style="margin: 10px 0; font-size:1.2rem;">Raciones: <strong>${item.servings}</strong></p>
            <div style="display:flex; gap:8px;">
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
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    
    days.forEach(day => {
        const d = day.toLowerCase();
        container.innerHTML += `
            <div class="planner-day-card">
                <h3>${day}</h3>
                <div class="planner-meals-grid">
                    <div class="meal-slot" onclick="openPlanModal('${d}', 'comida')">
                        <small>☀️ Comida</small><div><strong>${state.planner[d+'_comida'] || '- Vacío -'}</strong></div>
                    </div>
                    <div class="meal-slot" onclick="openPlanModal('${d}', 'cena')">
                        <small>🌙 Cena</small><div><strong>${state.planner[d+'_cena'] || '- Vacío -'}</strong></div>
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
    document.getElementById('plan-day').value = day; document.getElementById('plan-type').value = type;
    const select = document.getElementById('plan-dish-select');
    select.innerHTML = '<option value="">- Vaciar -</option>';
    state.recipes.forEach(r => { select.innerHTML += `<option value="${r.name}">${r.name}</option>`; });
    document.getElementById('plan-modal').classList.add('active');
}
function savePlannerChoice(e) {
    e.preventDefault();
    const key = document.getElementById('plan-day').value + '_' + document.getElementById('plan-type').value;
    state.planner[key] = document.getElementById('plan-dish-select').value;
    saveData(); closeModals();
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
