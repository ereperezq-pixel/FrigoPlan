// Lógica principal - ChefGuard

const DEFAULT_FOODS = {
    Comida: ['Alubias', 'Lentejas', 'Arroz', 'Pollo', 'Pasta', 'Pasta de legumbre'],
    Cena: ['Pescado', 'Pavo', 'Carne picada', 'Salchichas']
};

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
    const saved = localStorage.getItem('chefguard_data');
    if (saved) {
        try {
            state = JSON.parse(saved);
        } catch (e) {
            console.error("Error al cargar datos", e);
        }
    } else {
        // Datos por defecto si no hay nada guardado
        state.stock = [
            { id: '1', name: 'Alubias', category: 'Comida', servings: 6, created: 'Martes' },
            { id: '2', name: 'Lentejas', category: 'Comida', servings: 6, created: 'Martes' }
        ];
    }
    saveState();
}

function saveState() {
    localStorage.setItem('chefguard_data', JSON.stringify(state));
    renderAll();
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    setupSundayReport();
    updateDishOptions();
});

// Renderizar UI
function renderAll() {
    renderStockGrid();
    renderPlanner();
    renderStats();
}

// 1. Mostrar Solo Alimentos en Congelador (> 0 Raciones)
function renderStockGrid() {
    const grid = document.getElementById('stock-grid');
    const emptyMsg = document.getElementById('empty-stock-msg');
    const freezerCount = document.getElementById('freezer-count');

    grid.innerHTML = '';

    // Filtrar estrictamente raciones > 0
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

// Cambiar Raciones
function changeServings(id, delta) {
    const item = state.stock.find(i => i.id === id);
    if (!item) return;

    item.servings += delta;

    if (delta < 0) {
        state.weeklyLog.push({
            dish: item.name,
            timestamp: new Date().toISOString()
        });
    }

    saveState();
}

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

    // Verificar si ya existe en stock
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

// Navegación Pestañas
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    document.querySelector(`[onclick="switchTab('${tabId}')"]`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
}

// Renderizar Planificador
function renderPlanner() {
    const container = document.getElementById('week-planner-container');
    container.innerHTML = '';

    DAYS_OF_WEEK.forEach(day => {
        const dayCard = document.createElement('div');
        dayCard.className = 'day-card';
        dayCard.innerHTML = `
            <div class="day-title">${day}</div>
            <div class="day-slots">
                <div class="slot-box">
                    <div class="slot-label">☀️ Comida</div>
                    <div>${state.planner[day + '_comida'] || 'Sin planificar'}</div>
                </div>
                <div class="slot-box">
                    <div class="slot-label">🌙 Cena</div>
                    <div>${state.planner[day + '_cena'] || 'Sin planificar'}</div>
                </div>
            </div>
        `;
        container.appendChild(dayCard);
    });
}

// Renderizar Estadísticas
function renderStats() {
    const totalConsumed = state.weeklyLog.length;
    document.getElementById('stats-total-consumed').textContent = totalConsumed;

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

// Verificación Informe Domingo 21:00h
function setupSundayReport() {
    const now = new Date();
    const day = now.getDay(); // 0 = Domingo
    const hour = now.getHours();

    // Si es Domingo y >= 21:00h
    if (day === 0 && hour >= 21) {
        const banner = document.getElementById('sunday-report-banner');
        const details = document.getElementById('report-details');

        const activeStock = state.stock.filter(i => i.servings > 0);
        let summaryHTML = `<p><strong>Consumos de esta semana:</strong> ${state.weeklyLog.length} raciones extraídas.</p>`;
        summaryHTML += `<p style="margin-top: 6px;"><strong>Stock disponible para la próxima semana:</strong></p><ul>`;

        activeStock.forEach(i => {
            summaryHTML += `<li>${i.name}: ${i.servings} raciones</li>`;
        });
        summaryHTML += `</ul>`;

        details.innerHTML = summaryHTML;
        banner.classList.remove('hidden');
    }
}

function closeReportBanner() {
    document.getElementById('sunday-report-banner').classList.add('hidden');
}

// Registro Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(() => console.log('Service Worker Registrado'))
        .catch(err => console.log('Error SW:', err));
}
