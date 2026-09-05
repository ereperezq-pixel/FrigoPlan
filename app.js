// Lógica principal - FrigoPlan

const INITIAL_RECIPES = [
    { name: 'Alubias', category: 'Comida', freezable: true },
    { name: 'Lentejas', category: 'Comida', freezable: true },
    { name: 'Arroz', category: 'Comida', freezable: false },
    { name: 'Pollo', category: 'Comida', freezable: false },
    { name: 'Pasta', category: 'Comida', freezable: false },
    { name: 'Pasta de legumbre', category: 'Comida', freezable: false },
    { name: 'Pescado', category: 'Cena', freezable: false },
    { name: 'Pavo', category: 'Cena', freezable: false },
    { name: 'Carne picada', category: 'Cena', freezable: false },
    { name: 'Salchichas', category: 'Cena', freezable: false }
];

const FOOD_ICONS = {
    'Alubias': '🫘',
    'Lentejas': '🍲',
    'Arroz': '🍚',
    'Pollo': '🍗',
    'Pasta': '🍝',
    'Pasta de legumbre': '🌱',
    'Pescado': '🐟',
    'Pavo': '🦃',
    'Carne picada': '🥩',
    'Salchichas': '🌭'
};

const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Estado Global
let state = {
    stock: [],
    recipes: [],
    weeklyLog: [],
    planner: {},
    lastAutoDeductDate: ''
};

// Cargar Datos
function loadState() {
    const saved = localStorage.getItem('frigoplan_data');
    if (saved) {
        try {
            state = JSON.parse(saved);
        } catch (e) {
            console.error("Error al cargar datos", e);
        }
    }
    
    if (!state.recipes || state.recipes.length === 0) {
        state.recipes = [...INITIAL_RECIPES];
    }
    if (!state.stock) {
        state.stock = [
            { id: '1', name: 'Alubias', category: 'Comida', servings: 6 },
            { id: '2', name: 'Lentejas', category: 'Comida', servings: 0 }
        ];
    }
    if (!state.planner) {
        state.planner = { 'Lunes_comida': 'Alubias', 'Martes_comida': 'Lentejas' };
    }

    checkAutoDeduct9PM();
    saveState();
}

function saveState() {
    localStorage.setItem('frigoplan_data', JSON.stringify(state));
    renderAll();
}

document.addEventListener('DOMContentLoaded', () => {
    loadState();
    setupSundayReport();
    updateDishOptions();
});

function renderAll() {
    renderStockGrid();
    renderDailySummary();
    renderPlanner();
    renderRecipes();
    renderAlerts();
    renderStats();
}

// Comprobación de Stock para guisos congelables
function checkGuisoStock(dishName) {
    if (!dishName) return null;
    const recipe = state.recipes.find(r => r.name.toLowerCase().trim() === dishName.toLowerCase().trim());
    
    // Solo si es una receta marcada como congelable
    if (!recipe || !recipe.freezable) return null;

    const item = state.stock.find(i => i.name.toLowerCase().trim() === dishName.toLowerCase().trim());
    const servings = item ? item.servings : 0;

    return {
        isGuiso: true,
        servings: servings,
        hasStock: servings > 0
    };
}

// 1. Congelador (Solo stock > 0)
function renderStockGrid() {
    const grid = document.getElementById('stock-grid');
    const emptyMsg = document.getElementById('empty-stock-msg');
    const freezerCount = document.getElementById('freezer-count');

    grid.innerHTML = '';
    const activeStock = state.stock.filter(item => item.servings > 0);
    freezerCount.textContent = activeStock.reduce((acc, curr) => acc + curr.servings, 0);

    if (activeStock.length === 0) {
        emptyMsg.classList.remove('hidden');
        return;
    }

    emptyMsg.classList.add('hidden');

    activeStock.forEach(item => {
        const icon = FOOD_ICONS[item.name] || '🥘';
        const card = document.createElement('div');
        card.className = `stock-card ${item.category.toLowerCase()}`;
        card.innerHTML = `
            <div class="card-header">
                <span class="dish-icon">${icon}</span>
                <div>
                    <div class="dish-title">${item.name}</div>
                    <span class="dish-badge badge-${item.category.toLowerCase()}">${item.category}</span>
                </div>
            </div>
            <div class="servings-control">
                <button class="btn-counter btn-minus" onclick="changeServings('${item.id}', -1)">-</button>
                <div>
                    <span class="servings-count">${item.servings}</span>
                    <span style="font-size: 0.8rem; color: #666;"> raciones</span>
                </div>
                <button class="btn-counter btn-plus" onclick="changeServings('${item.id}', 1)">+</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function changeServings(id, delta) {
    const item = state.stock.find(i => i.id === id);
    if (!item) return;

    item.servings += delta;
    if (delta < 0) {
        state.weeklyLog.push({ dish: item.name, timestamp: new Date().toISOString() });
    }
    saveState();
}

// 2. Resumen Diario en Página Principal (Hoy y Mañana)
function getTodayAndTomorrowNames() {
    const todayIndex = new Date().getDay(); // 0: Dom, 1: Lun, ...
    const jsToSpanishIndex = todayIndex === 0 ? 6 : todayIndex - 1;
    const tomorrowIndex = (jsToSpanishIndex + 1) % 7;

    return {
        today: DAYS_OF_WEEK[jsToSpanishIndex],
        tomorrow: DAYS_OF_WEEK[tomorrowIndex]
    };
}

function renderDailySummary() {
    const days = getTodayAndTomorrowNames();

    document.getElementById('today-lunch').textContent = state.planner[`${days.today}_comida`] || 'Sin planificar';
    document.getElementById('today-dinner').textContent = state.planner[`${days.today}_cena`] || 'Sin planificar';

    document.getElementById('tomorrow-lunch').textContent = state.planner[`${days.tomorrow}_comida`] || 'Sin planificar';
    document.getElementById('tomorrow-dinner').textContent = state.planner[`${days.tomorrow}_cena`] || 'Sin planificar';
}

function openMainChangeModal(type) {
    const days = getTodayAndTomorrowNames();
    openPlanModal(days.today, type);
}

// 3. Extracción Automática de Stock a las 21:00h
function checkAutoDeduct9PM() {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Si ya se procesó hoy o no son las 21:00h pasadas, salir
    if (state.lastAutoDeductDate === todayStr || now.getHours() < 21) {
        return;
    }

    const days = getTodayAndTomorrowNames();
    const todayName = days.today;

    ['comida', 'cena'].forEach(type => {
        const dishName = state.planner[`${todayName}_${type}`];
        if (dishName) {
            const stockItem = state.stock.find(i => i.name.toLowerCase().trim() === dishName.toLowerCase().trim());
            if (stockItem && stockItem.servings > 0) {
                stockItem.servings -= 1;
                state.weeklyLog.push({ dish: stockItem.name, timestamp: now.toISOString(), auto: true });
            }
        }
    });

    state.lastAutoDeductDate = todayStr;
}

// 4. Renderizar Avisos
function renderAlerts() {
    const alertsSection = document.getElementById('alerts-section');
    alertsSection.innerHTML = '';

    const days = getTodayAndTomorrowNames();

    // Aviso A: Descongelar mañana si toca guiso congelado
    const tomorrowLunch = state.planner[`${days.tomorrow}_comida`] || '';
    const tomorrowDinner = state.planner[`${days.tomorrow}_cena`] || '';

    [tomorrowLunch, tomorrowDinner].forEach(dish => {
        if (dish) {
            const check = checkGuisoStock(dish);
            if (check && check.isGuiso && check.hasStock) {
                const alertBox = document.createElement('div');
                alertBox.className = 'alert-card alert-defrost';
                alertBox.innerHTML = `❄️ <strong>Aviso Descongelación:</strong> Sacar del congelador <strong>${dish}</strong> para mañana (${days.tomorrow}).`;
                alertsSection.appendChild(alertBox);
            }
        }
    });

    // Aviso B: Anunciar si hay que guisar por falta de stock
    DAYS_OF_WEEK.forEach(day => {
        ['comida', 'cena'].forEach(type => {
            const dish = state.planner[`${day}_${type}`];
            if (dish) {
                const check = checkGuisoStock(dish);
                if (check && check.isGuiso && !check.hasStock) {
                    const alertBox = document.createElement('div');
                    alertBox.className = 'alert-card alert-cook';
                    alertBox.innerHTML = `👨‍🍳 <strong>Atención Cocina:</strong> Planificado <strong>${dish}</strong> el ${day}, pero NO hay stock. ¡Hay que guisar!`;
                    alertsSection.appendChild(alertBox);
                }
            }
        });
    });
}

// 5. Planificador Semanal con Desplegable
function renderPlanner() {
    const container = document.getElementById('week-planner-container');
    container.innerHTML = '';

    DAYS_OF_WEEK.forEach(day => {
        const lunchDish = state.planner[`${day}_comida`] || 'Sin fijar';
        const dinnerDish = state.planner[`${day}_cena`] || 'Sin fijar';

        const lunchCheck = checkGuisoStock(lunchDish);
        const dinnerCheck = checkGuisoStock(dinnerDish);

        const dayCard = document.createElement('div');
        dayCard.className = 'day-card';
        dayCard.innerHTML = `
            <div class="day-title">${day}</div>
            <div class="day-slots">
                <div class="slot-box" onclick="openPlanModal('${day}', 'comida')">
                    <div class="slot-label">☀️ Comida</div>
                    <div class="slot-value">${lunchDish}</div>
                    ${getSlotStatusHTML(lunchCheck)}
                </div>
                <div class="slot-box" onclick="openPlanModal('${day}', 'cena')">
                    <div class="slot-label">🌙 Cena</div>
                    <div class="slot-value">${dinnerDish}</div>
                    ${getSlotStatusHTML(dinnerCheck)}
                </div>
            </div>
        `;
        container.appendChild(dayCard);
    });
}

function getSlotStatusHTML(check) {
    if (!check || !check.isGuiso) return '';
    if (check.hasStock) {
        return `<div class="slot-status status-ok">✓ Hay stock (${check.servings} rac)</div>`;
    } else {
        return `<div class="slot-status status-cook">⚠️ Tienes que guisar (0 rac)</div>`;
    }
}

function openPlanModal(day, type) {
    document.getElementById('plan-day').value = day;
    document.getElementById('plan-type').value = type;
    document.getElementById('plan-modal-title').textContent = `Seleccionar ${type} del ${day}`;

    const select = document.getElementById('plan-dish-select');
    select.innerHTML = '<option value="">-- Seleccionar alimento --</option>';

    // Rellenar con las recetas registradas
    const catTarget = type === 'comida' ? 'Comida' : 'Cena';
    const filteredRecipes = state.recipes.filter(r => r.category === catTarget || true);

    filteredRecipes.forEach(recipe => {
        const opt = document.createElement('option');
        opt.value = recipe.name;
        opt.textContent = `${FOOD_ICONS[recipe.name] || '🥘'} ${recipe.name} ${recipe.freezable ? '(Congelable)' : ''}`;
        select.appendChild(opt);
    });

    const currentDish = state.planner[`${day}_${type}`] || '';
    select.value = currentDish;

    onPlanSelectChange();
    document.getElementById('plan-modal').classList.add('active');
}

function onPlanSelectChange() {
    const selected = document.getElementById('plan-dish-select').value;
    const infoBox = document.getElementById('stock-availability-info');
    const check = checkGuisoStock(selected);

    if (check && check.isGuiso) {
        infoBox.classList.remove('hidden');
        if (check.hasStock) {
            infoBox.className = 'info-alert alert-defrost';
            infoBox.innerHTML = `✅ Guiso congelable: Tienes ${check.servings} raciones en stock.`;
        } else {
            infoBox.className = 'info-alert alert-cook';
            infoBox.innerHTML = `⚠️ Guiso congelable: NO hay raciones en el congelador. Tendrás que guisar.`;
        }
    } else {
        infoBox.classList.add('hidden');
    }
}

function closePlanModal() {
    document.getElementById('plan-modal').classList.remove('active');
}

document.getElementById('plan-dish-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const day = document.getElementById('plan-day').value;
    const type = document.getElementById('plan-type').value;
    const dish = document.getElementById('plan-dish-select').value;

    state.planner[`${day}_${type}`] = dish;
    closePlanModal();
    saveState();
});

// 6. Catálogo de Recetas y Modal
function renderRecipes() {
    const list = document.getElementById('recipes-list');
    list.innerHTML = '';

    state.recipes.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'recipe-card';
        card.innerHTML = `
            <div class="card-header">
                <span class="dish-icon">${FOOD_ICONS[recipe.name] || '🍲'}</span>
                <div>
                    <div class="dish-title">${recipe.name}</div>
                    <span class="dish-badge badge-${recipe.category.toLowerCase()}">${recipe.category}</span>
                </div>
            </div>
            <div style="font-size: 0.85rem; color: #555; margin-top: 6px;">
                ${recipe.freezable ? '❄️ Admite congelación' : '🍳 Plato fresco / cocina rápida'}
            </div>
        `;
        list.appendChild(card);
    });
}

function openAddRecipeModal() {
    document.getElementById('add-recipe-modal').classList.add('active');
}

function closeAddRecipeModal() {
    document.getElementById('add-recipe-modal').classList.remove('active');
}

document.getElementById('add-recipe-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('recipe-name').value.trim();
    const category = document.getElementById('recipe-category').value;
    const freezable = document.getElementById('recipe-freezable').checked;

    if (name) {
        const existing = state.recipes.find(r => r.name.toLowerCase() === name.toLowerCase());
        if (!existing) {
            state.recipes.push({ name, category, freezable });
        }
    }

    document.getElementById('recipe-name').value = '';
    document.getElementById('recipe-freezable').checked = false;
    closeAddRecipeModal();
    updateDishOptions();
    saveState();
});

// Modal Añadir Guiso al Congelador
function openAddModal() {
    updateDishOptions();
    document.getElementById('add-modal').classList.add('active');
}

function closeAddModal() {
    document.getElementById('add-modal').classList.remove('active');
}

function updateDishOptions() {
    const cat = document.getElementById('dish-category').value;
    const select = document.getElementById('dish-name');
    select.innerHTML = '';

    // Filtrar recetas que sean congelables
    const freezableRecipes = state.recipes.filter(r => r.category === cat && r.freezable);

    freezableRecipes.forEach(recipe => {
        const opt = document.createElement('option');
        opt.value = recipe.name;
        opt.textContent = `${FOOD_ICONS[recipe.name] || '🥘'} ${recipe.name}`;
        select.appendChild(opt);
    });

    if (freezableRecipes.length === 0) {
        select.innerHTML = '<option value="">No hay recetas congelables en esta categoría</option>';
    }
}

document.getElementById('add-dish-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const category = document.getElementById('dish-category').value;
    const name = document.getElementById('dish-name').value;
    const servings = parseInt(document.getElementById('dish-servings').value, 10);

    if (!name) return;

    const existing = state.stock.find(i => i.name.toLowerCase() === name.toLowerCase() && i.category === category);

    if (existing) {
        existing.servings += servings;
    } else {
        state.stock.push({
            id: Date.now().toString(),
            name: name,
            category: category,
            servings: servings
        });
    }

    closeAddModal();
    saveState();
});

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    document.querySelector(`[onclick="switchTab('${tabId}')"]`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
}

function renderStats() {
    document.getElementById('stats-total-consumed').textContent = state.weeklyLog.length;
    const list = document.getElementById('full-inventory-list');
    list.innerHTML = '';

    if (state.stock.length === 0) {
        list.innerHTML = '<p>No hay registro de alimentos.</p>';
        return;
    }

    state.stock.forEach(item => {
        const p = document.createElement('div');
        p.style.padding = '8px 0';
        p.style.borderBottom = '1px solid #eee';
        p.innerHTML = `<strong>${item.name}</strong> (${item.category}): ${item.servings} raciones disponibles.`;
        list.appendChild(p);
    });
}

function setupSundayReport() {
    const now = new Date();
    if (now.getDay() === 0 && now.getHours() >= 21) {
        const banner = document.getElementById('sunday-report-banner');
        const details = document.getElementById('report-details');

        const activeStock = state.stock.filter(i => i.servings > 0);
        let summaryHTML = `<p><strong>Consumos de esta semana:</strong> ${state.weeklyLog.length} raciones extraídas.</p>`;
        summaryHTML += `<p style="margin-top: 6px;"><strong>Stock disponible:</strong></p><ul>`;
        activeStock.forEach(i => summaryHTML += `<li>${i.name}: ${i.servings} raciones</li>`);
        summaryHTML += `</ul>`;

        details.innerHTML = summaryHTML;
        banner.classList.remove('hidden');
    }
}

function closeReportBanner() {
    document.getElementById('sunday-report-banner').classList.add('hidden');
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
