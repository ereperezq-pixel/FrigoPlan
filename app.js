// Lógica principal - FrigoPlan

const DEFAULT_FOODS = {
    Comida: ['Alubias', 'Lentejas', 'Arroz', 'Pollo', 'Pasta', 'Pasta de legumbre'],
    Cena: ['Pescado', 'Pavo', 'Carne picada', 'Salchichas']
};

const CONGELABLE_FOODS = ['alubias', 'lentejas'];

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
    weeklyLog: [],
    planner: {}
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
    } else {
        // Ejemplo inicial
        state.stock = [
            { id: '1', name: 'Alubias', category: 'Comida', servings: 6 },
            { id: '2', name: 'Lentejas', category: 'Comida', servings: 0 }
        ];
        state.planner = {
            'Lunes_comida': 'Alubias',
            'Martes_comida': 'Lentejas'
        };
    }
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
    renderAlerts();
    renderStats();
}

// Comprobación de Stock para guisos
function checkGuisoStock(dishName) {
    const cleanName = dishName.toLowerCase().trim();
    if (!CONGELABLE_FOODS.includes(cleanName)) return null;

    const item = state.stock.find(i => i.name.toLowerCase().trim() === cleanName);
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
function renderDailySummary() {
    const todayIndex = new Date().getDay(); // 0: Dom, 1: Lun, ...
    const jsToSpanishIndex = todayIndex === 0 ? 6 : todayIndex - 1;
    const tomorrowIndex = (jsToSpanishIndex + 1) % 7;

    const todayDay = DAYS_OF_WEEK[jsToSpanishIndex];
    const tomorrowDay = DAYS_OF_WEEK[tomorrowIndex];

    document.getElementById('today-lunch').textContent = state.planner[`${todayDay}_comida`] || 'Sin planificar';
    document.getElementById('today-dinner').textContent = state.planner[`${todayDay}_cena`] || 'Sin planificar';

    document.getElementById('tomorrow-lunch').textContent = state.planner[`${tomorrowDay}_comida`] || 'Sin planificar';
    document.getElementById('tomorrow-dinner').textContent = state.planner[`${tomorrowDay}_cena`] || 'Sin planificar';
}

// 3. Renderizar Avisos (Descongelar y Guisar)
function renderAlerts() {
    const alertsSection = document.getElementById('alerts-section');
    alertsSection.innerHTML = '';

    const todayIndex = new Date().getDay();
    const jsToSpanishIndex = todayIndex === 0 ? 6 : todayIndex - 1;
    const tomorrowIndex = (jsToSpanishIndex + 1) % 7;
    const tomorrowDay = DAYS_OF_WEEK[tomorrowIndex];

    // Aviso A: Descongelar si mañana hay guiso congelado
    const tomorrowLunch = state.planner[`${tomorrowDay}_comida`] || '';
    const tomorrowDinner = state.planner[`${tomorrowDay}_cena`] || '';

    [tomorrowLunch, tomorrowDinner].forEach(dish => {
        if (dish) {
            const check = checkGuisoStock(dish);
            if (check && check.isGuiso && check.hasStock) {
                const alertBox = document.createElement('div');
                alertBox.className = 'alert-card alert-defrost';
                alertBox.innerHTML = `❄️ <strong>Aviso Descongelación:</strong> Recuerda saca hoy del congelador <strong>${dish}</strong> para mañana (${tomorrowDay}).`;
                alertsSection.appendChild(alertBox);
            }
        }
    });

    // Aviso B: Anunciar que hay que guisar si está planificado pero no hay stock
    DAYS_OF_WEEK.forEach(day => {
        ['comida', 'cena'].forEach(type => {
            const dish = state.planner[`${day}_${type}`];
            if (dish) {
                const check = checkGuisoStock(dish);
                if (check && check.isGuiso && !check.hasStock) {
                    const alertBox = document.createElement('div');
                    alertBox.className = 'alert-card alert-cook';
                    alertBox.innerHTML = `👨‍🍳 <strong>Atención Cocina:</strong> Planificado <strong>${dish}</strong> el ${day}, pero NO hay stock. ¡Tienes que guisar!`;
                    alertsSection.appendChild(alertBox);
                }
            }
        });
    });
}

// 4. Renderizar Planificador Semanal
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

// Modal de Planificación
function openPlanModal(day, type) {
    document.getElementById('plan-day').value = day;
    document.getElementById('plan-type').value = type;
    document.getElementById('plan-modal-title').textContent = `Fijar ${type} del ${day}`;

    const currentDish = state.planner[`${day}_${type}`] || '';
    const input = document.getElementById('plan-dish-input');
    input.value = currentDish;

    updateStockAlertInModal(currentDish);

    input.oninput = (e) => updateStockAlertInModal(e.target.value);

    document.getElementById('plan-modal').classList.add('active');
}

function updateStockAlertInModal(dishName) {
    const infoBox = document.getElementById('stock-availability-info');
    const check = checkGuisoStock(dishName);

    if (check && check.isGuiso) {
        infoBox.classList.remove('hidden');
        if (check.hasStock) {
            infoBox.className = 'info-alert alert-defrost';
            infoBox.innerHTML = `✅ Guiso detectado: Tienes ${check.servings} raciones en stock.`;
        } else {
            infoBox.className = 'info-alert alert-cook';
            infoBox.innerHTML = `⚠️ Guiso detectado: NO hay raciones en el congelador. Tendrás que guisar.`;
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
    const dish = document.getElementById('plan-dish-input').value.trim();

    state.planner[`${day}_${type}`] = dish;
    closePlanModal();
    saveState();
});

// Modal Añadir Guiso
function openAddModal() {
    document.getElementById('add-modal').classList.add('active');
}

function closeAddModal() {
    document.getElementById('add-modal').classList.remove('active');
}

function updateDishOptions() {
    const cat = document.getElementById('dish-category').value;
    const select = document.getElementById('dish-name');
    select.innerHTML = '';

    DEFAULT_FOODS[cat].forEach(food => {
        const opt = document.createElement('option');
        opt.value = food;
        opt.textContent = `${FOOD_ICONS[food] || ''} ${food}`;
        select.appendChild(opt);
    });
}

document.getElementById('add-dish-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const category = document.getElementById('dish-category').value;
    const selectName = document.getElementById('dish-name').value;
    const customName = document.getElementById('dish-custom-name').value.trim();
    const servings = parseInt(document.getElementById('dish-servings').value, 10);

    const name = customName.length > 0 ? customName : selectName;
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

    document.getElementById('dish-custom-name').value = '';
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
