/**
 * Chilean Salary Calculator & Budget App v2.0.0 - 2026 Edition
 * Actualizado con valores oficiales Marzo 2026
 * Features: Dark Mode, Chart.js, LocalStorage Persistence
 */

// --- CONSTANTS 2026 ---
const CONSTANTS = {
    AFP_RATE: 0.1077,              // 10.77% promedio AFPs (10% + comisión)
    HEALTH_RATE: 0.07,            // 7% Salud FONASA/ISAPRE
    UNEMPLOYMENT_INDEFINITE: 0.006, // 0.6% Seguro Cesantía contrato indefinido
    UNEMPLOYMENT_FIXED: 0.0,       // 0% Seguro Cesantía contrato plazo fijo
    MAX_TAXABLE_BASE_UF: 89.9,     // ✅ TOPE IMPONIBLE 2026: 89.9 UF
    UF_VALUE: 39800,              // ✅ UF aproximada marzo 2026 (~$39.800)
    MAX_TAXABLE_BASE_CLP: 89.9 * 39800 // ~$3.578.020
};

// ✅ TAX_BRACKETS 2026 - Oficial SII (valores mensuales actualizados)
const TAX_BRACKETS = [
    { limit: 943501, factor: 0, deduction: 0, label: "Exento" },           // Hasta 13.5 UTM
    { limit: 2096670, factor: 0.04, deduction: 37740, label: "Tramo 1" },  // 4% - Rebaja $37.740
    { limit: 3494450, factor: 0.08, deduction: 121607, label: "Tramo 2" }, // 8% - Rebaja $121.607
    { limit: 4892230, factor: 0.135, deduction: 313802, label: "Tramo 3" }, // 13.5% - Rebaja $313.802
    { limit: 6290010, factor: 0.23, deduction: 778563, label: "Tramo 4" },   // ✅ 23% (antes 13.5%)
    { limit: 8386680, factor: 0.304, deduction: 1244024, label: "Tramo 5" }, // ✅ 30.4% (antes 23%)
    { limit: 21665590, factor: 0.35, deduction: 1629811, label: "Tramo 6" }, // 35%
    { limit: Infinity, factor: 0.40, deduction: 2713091, label: "Tramo 7" }  // 40%
];

// Categorías de gastos para análisis 50/30/20
const EXPENSE_CATEGORIES = {
    vivienda: { type: 'need', label: '🏠 Vivienda', color: '#f59e0b' },
    cuentas: { type: 'need', label: '💡 Cuentas Básicas', color: '#f59e0b' },
    supermercado: { type: 'need', label: '🛒 Supermercado', color: '#f59e0b' },
    transporte: { type: 'need', label: '🚌 Transporte', color: '#f59e0b' },
    salud: { type: 'need', label: '🏥 Salud', color: '#f59e0b' },
    deudas: { type: 'need', label: '💳 Deudas', color: '#f59e0b' },
    ocio: { type: 'want', label: '🍿 Ocio', color: '#ef4444' },
    otros: { type: 'want', label: '📦 Otros', color: '#ef4444' }
};

// --- UTILITY FUNCTIONS ---

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        maximumFractionDigits: 0
    }).format(amount);
}

function formatNumber(number) {
    return new Intl.NumberFormat('es-CL').format(number);
}

// --- CALCULATION FUNCTIONS ---

function calculateSalary(grossSalary, contractType = 'indefinido') {
    const gross = Math.max(0, Number(grossSalary));
    
    // Aplicar tope imponible
    const taxableBase = Math.min(gross, CONSTANTS.MAX_TAXABLE_BASE_CLP);
    
    // 1. Cotizaciones Obligatorias (sobre tope imponible)
    const afp = Math.round(taxableBase * CONSTANTS.AFP_RATE);
    const health = Math.round(taxableBase * CONSTANTS.HEALTH_RATE);
    
    const unemploymentRate = contractType === 'indefinido' 
        ? CONSTANTS.UNEMPLOYMENT_INDEFINITE 
        : CONSTANTS.UNEMPLOYMENT_FIXED;
    const unemployment = Math.round(taxableBase * unemploymentRate);
    
    const totalSocialDeductions = afp + health + unemployment;
    
    // 2. Renta Líquida Imponible (para impuesto)
    const taxableIncome = gross - totalSocialDeductions;
    
    // 3. Impuesto Único de Segunda Categoría (sobre renta líquida imponible)
    let tax = 0;
    let taxBracket = TAX_BRACKETS[0];
    
    if (taxableIncome > 0) {
        for (const bracket of TAX_BRACKETS) {
            if (taxableIncome <= bracket.limit) {
                tax = (taxableIncome * bracket.factor) - bracket.deduction;
                taxBracket = bracket;
                break;
            }
        }
        // Si supera el último tramo
        if (taxableIncome > TAX_BRACKETS[TAX_BRACKETS.length - 2].limit) {
            const lastBracket = TAX_BRACKETS[TAX_BRACKETS.length - 1];
            tax = (taxableIncome * lastBracket.factor) - lastBracket.deduction;
            taxBracket = lastBracket;
        }
    }
    
    tax = Math.max(0, Math.round(tax));
    
    // 4. Sueldo Líquido
    const liquid = gross - totalSocialDeductions - tax;
    
    // 5. Tasa efectiva de impuesto
    const effectiveTaxRate = gross > 0 ? ((tax / gross) * 100).toFixed(1) : 0;
    
    return {
        gross,
        afp,
        health,
        unemployment,
        tax,
        liquid,
        totalSocialDeductions,
        taxableIncome,
        taxBracket: taxBracket.label,
        effectiveTaxRate
    };
}

// --- STATE MANAGEMENT ---

const state = {
    grossSalary: 1000000,
    contractType: 'indefinido',
    liquidSalary: 0,
    expenses: [],
    charts: {}
};

// --- LOCALSTORAGE FUNCTIONS ---

const STORAGE_KEYS = {
    EXPENSES: 'presupuesto_chile_expenses',
    SALARY: 'presupuesto_chile_salary',
    CONTRACT: 'presupuesto_chile_contract'
};

function saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(state.expenses));
        localStorage.setItem(STORAGE_KEYS.SALARY, state.grossSalary.toString());
        localStorage.setItem(STORAGE_KEYS.CONTRACT, state.contractType);
    } catch (e) {
        console.warn('LocalStorage no disponible:', e);
    }
}

function loadFromStorage() {
    try {
        const savedExpenses = localStorage.getItem(STORAGE_KEYS.EXPENSES);
        const savedSalary = localStorage.getItem(STORAGE_KEYS.SALARY);
        const savedContract = localStorage.getItem(STORAGE_KEYS.CONTRACT);
        
        if (savedExpenses) {
            state.expenses = JSON.parse(savedExpenses);
        }
        if (savedSalary) {
            state.grossSalary = parseInt(savedSalary);
        }
        if (savedContract) {
            state.contractType = savedContract;
        }
        return true;
    } catch (e) {
        console.warn('Error cargando de LocalStorage:', e);
        return false;
    }
}

function clearStorage() {
    try {
        localStorage.removeItem(STORAGE_KEYS.EXPENSES);
        localStorage.removeItem(STORAGE_KEYS.SALARY);
        localStorage.removeItem(STORAGE_KEYS.CONTRACT);
    } catch (e) {
        console.warn('Error limpiando LocalStorage:', e);
    }
}

// --- CHART.JS FUNCTIONS ---

function initSalaryChart(result) {
    const ctx = document.getElementById('salary-chart');
    if (!ctx) return;
    
    // Destruir gráfico anterior si existe
    if (state.charts.salary) {
        state.charts.salary.destroy();
    }
    
    state.charts.salary = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Sueldo Líquido', 'AFP', 'Salud', 'Cesantía', 'Impuesto'],
            datasets: [{
                data: [result.liquid, result.afp, result.health, result.unemployment, result.tax],
                backgroundColor: [
                    '#10b981', // Liquido - verde
                    '#3b82f6', // AFP - azul
                    '#8b5cf6', // Salud - violeta
                    '#f59e0b', // Cesantía - amarillo
                    '#ef4444'  // Impuesto - rojo
                ],
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#9ca3af',
                        padding: 16,
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function initBudgetChart() {
    const ctx = document.getElementById('budget-chart');
    if (!ctx) return;
    
    if (state.charts.budget) {
        state.charts.budget.destroy();
    }
    
    // Calcular totales por categoría
    const needs = state.expenses
        .filter(e => EXPENSE_CATEGORIES[e.category]?.type === 'need')
        .reduce((sum, e) => sum + e.amount, 0);
    const wants = state.expenses
        .filter(e => EXPENSE_CATEGORIES[e.category]?.type === 'want')
        .reduce((sum, e) => sum + e.amount, 0);
    const savings = Math.max(0, state.liquidSalary - needs - wants);
    
    state.charts.budget = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Necesidades (50%)', 'Deseos (30%)', 'Ahorro (20%)'],
            datasets: [{
                data: [needs, wants, savings],
                backgroundColor: ['#f59e0b', '#ef4444', '#10b981'],
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#9ca3af',
                        padding: 16
                    }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const percentage = state.liquidSalary > 0 
                                ? ((value / state.liquidSalary) * 100).toFixed(1) 
                                : 0;
                            return `${context.label}: ${formatCurrency(value)} (${percentage}% del líquido)`;
                        }
                    }
                }
            }
        }
    });
}

// --- UI FUNCTIONS ---

let els = {};

function initElements() {
    els = {
        inputs: {
            gross: document.getElementById('gross-salary'),
            contract: document.getElementById('contract-type')
        },
        results: {
            afp: document.getElementById('val-afp'),
            health: document.getElementById('val-health'),
            unemployment: document.getElementById('val-unemployment'),
            tax: document.getElementById('val-tax'),
            liquid: document.getElementById('val-liquid'),
            taxBracket: document.getElementById('val-tax-bracket'),
            effectiveRate: document.getElementById('val-effective-rate')
        },
        budget: {
            available: document.getElementById('budget-available'),
            expensesTotal: document.getElementById('budget-expenses'),
            savingsTarget: document.getElementById('budget-savings-target'),
            expenseList: document.getElementById('expense-list'),
            bars: {
                needs: document.getElementById('bar-needs'),
                wants: document.getElementById('bar-wants'),
                savings: document.getElementById('bar-savings')
            },
            barLabels: {
                needs: document.getElementById('label-needs'),
                wants: document.getElementById('label-wants'),
                savings: document.getElementById('label-savings')
            }
        },
        nav: document.querySelectorAll('.nav-btn'),
        views: {
            salary: document.getElementById('view-salary'),
            budget: document.getElementById('view-budget')
        },
        btns: {
            addToBudget: document.getElementById('add-to-budget-btn'),
            addExpense: document.getElementById('add-expense-btn'),
            saveExpense: document.getElementById('save-expense-btn'),
            closeModal: document.querySelector('.close-modal'),
            resetData: document.getElementById('reset-data-btn')
        },
        modal: {
            el: document.getElementById('modal-expense'),
            category: document.getElementById('expense-category'),
            name: document.getElementById('expense-name'),
            amount: document.getElementById('expense-amount')
        },
        info: {
            yearBadge: document.getElementById('year-badge'),
            ufValue: document.getElementById('uf-value'),
            topeImponible: document.getElementById('tope-imponible')
        }
    };
}

function updateInfoBadge() {
    if (els.info.yearBadge) {
        els.info.yearBadge.textContent = '2026';
    }
    if (els.info.ufValue) {
        els.info.ufValue.textContent = formatCurrency(CONSTANTS.UF_VALUE);
    }
    if (els.info.topeImponible) {
        els.info.topeImponible.textContent = `${CONSTANTS.MAX_TAXABLE_BASE_UF} UF (${formatCurrency(CONSTANTS.MAX_TAXABLE_BASE_CLP)})`;
    }
}

function updateSalary() {
    const gross = parseInt(els.inputs.gross.value) || 0;
    const contract = els.inputs.contract.value;
    
    state.grossSalary = gross;
    state.contractType = contract;
    
    const result = calculateSalary(gross, contract);
    state.liquidSalary = result.liquid;
    
    // Update UI con animación
    animateValue(els.results.afp, result.afp, true);
    animateValue(els.results.health, result.health, true);
    animateValue(els.results.unemployment, result.unemployment, true);
    animateValue(els.results.tax, result.tax, true);
    animateValue(els.results.liquid, result.liquid, false);
    
    if (els.results.taxBracket) {
        els.results.taxBracket.textContent = result.taxBracket;
    }
    if (els.results.effectiveRate) {
        els.results.effectiveRate.textContent = `${result.effectiveTaxRate}%`;
    }

    const unemploymentRateEl = document.getElementById('unemployment-rate');
    if (unemploymentRateEl) {
        unemploymentRateEl.textContent = contract === 'indefinido' ? '0.6%' : '0%';
    }
    
    // Actualizar gráfico
    initSalaryChart(result);
    
    // Guardar en storage
    saveToStorage();
}

function animateValue(element, value, isNegative) {
    if (!element) return;
    const formatted = isNegative ? '-' + formatCurrency(value) : formatCurrency(value);
    element.textContent = formatted;
    element.classList.add('updated');
    setTimeout(() => element.classList.remove('updated'), 300);
}

function updateBudgetSummary() {
    const needs = state.expenses
        .filter(e => EXPENSE_CATEGORIES[e.category]?.type === 'need')
        .reduce((sum, e) => sum + e.amount, 0);
    const wants = state.expenses
        .filter(e => EXPENSE_CATEGORIES[e.category]?.type === 'want')
        .reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = needs + wants;
    const available = state.liquidSalary - totalExpenses;
    
    // Metas 50/30/20
    const needsTarget = state.liquidSalary * 0.5;
    const wantsTarget = state.liquidSalary * 0.3;
    const savingsTarget = state.liquidSalary * 0.2;
    
    // Update UI
    els.budget.available.textContent = formatCurrency(available);
    els.budget.expensesTotal.textContent = formatCurrency(totalExpenses);
    els.budget.savingsTarget.textContent = formatCurrency(savingsTarget);
    
    // Update bar labels con porcentajes
    const needsPct = state.liquidSalary > 0 ? Math.min(100, (needs / needsTarget) * 50) : 0;
    const wantsPct = state.liquidSalary > 0 ? Math.min(100, (wants / wantsTarget) * 30) : 0;
    const savingsPct = state.liquidSalary > 0 ? Math.max(0, (available / state.liquidSalary) * 100) : 0;
    
    els.budget.bars.needs.style.width = `${Math.min(100, (needs / state.liquidSalary) * 100)}%`;
    els.budget.bars.wants.style.width = `${Math.min(100, (wants / state.liquidSalary) * 100)}%`;
    els.budget.bars.savings.style.width = `${Math.min(100, savingsPct)}%`;
    
    if (els.budget.barLabels.needs) {
        els.budget.barLabels.needs.textContent = `${needsPct.toFixed(0)}% de 50%`;
    }
    if (els.budget.barLabels.wants) {
        els.budget.barLabels.wants.textContent = `${wantsPct.toFixed(0)}% de 30%`;
    }
    if (els.budget.barLabels.savings) {
        els.budget.barLabels.savings.textContent = `${savingsPct.toFixed(0)}%`;
    }
    
    // Color según disponible
    if (available < 0) {
        els.budget.available.style.color = 'var(--danger)';
    } else if (available < savingsTarget * 0.5) {
        els.budget.available.style.color = 'var(--warning)';
    } else {
        els.budget.available.style.color = 'var(--success)';
    }
    
    // Actualizar gráfico
    initBudgetChart();
    
    // Guardar
    saveToStorage();
}

function renderExpenses() {
    const container = els.budget.expenseList;
    container.innerHTML = '';
    
    if (state.expenses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="ph ph-receipt" style="font-size: 3rem; opacity: 0.3;"></i>
                <p>Agrega gastos para ver tu resumen</p>
            </div>
        `;
        return;
    }
    
    // Ordenar por fecha (más reciente primero)
    const sortedExpenses = [...state.expenses].sort((a, b) => b.id - a.id);
    
    sortedExpenses.forEach(exp => {
        const catConfig = EXPENSE_CATEGORIES[exp.category] || { label: exp.category, color: '#3b82f6' };
        const div = document.createElement('div');
        div.className = 'expense-item';
        div.style.borderLeftColor = catConfig.color;
        
        div.innerHTML = `
            <div class="expense-info">
                <span class="expense-cat">${catConfig.label}</span>
                <span class="expense-name">${exp.name || 'Sin descripción'}</span>
            </div>
            <div class="expense-actions">
                <strong>${formatCurrency(exp.amount)}</strong>
                <button class="btn-delete" data-id="${exp.id}" title="Eliminar">
                    <i class="ph ph-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
    
    // Re-attach delete listeners
    container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            removeExpense(id);
        });
    });
}

function openModal() {
    els.modal.el.classList.remove('hidden');
    els.modal.amount.value = '';
    els.modal.name.value = '';
    els.modal.amount.focus();
}

function closeModal() {
    els.modal.el.classList.add('hidden');
}

function saveExpense() {
    const category = els.modal.category.value;
    const name = els.modal.name.value.trim() || EXPENSE_CATEGORIES[category]?.label || category;
    const amount = parseInt(els.modal.amount.value);
    
    if (!isNaN(amount) && amount > 0) {
        state.expenses.push({
            id: Date.now(),
            category,
            name,
            amount,
            date: new Date().toISOString()
        });
        renderExpenses();
        updateBudgetSummary();
        closeModal();
        
        // Mostrar notificación
        showNotification('Gasto agregado', `${name}: ${formatCurrency(amount)}`);
    } else {
        showNotification('Error', 'Por favor ingresa un monto válido', 'error');
    }
}

function removeExpense(id) {
    const expense = state.expenses.find(e => e.id === id);
    state.expenses = state.expenses.filter(e => e.id !== id);
    renderExpenses();
    updateBudgetSummary();
    
    if (expense) {
        showNotification('Gasto eliminado', `${expense.name}: ${formatCurrency(expense.amount)}`);
    }
}

function resetData() {
    if (confirm('¿Estás seguro de eliminar todos los gastos guardados?')) {
        state.expenses = [];
        clearStorage();
        renderExpenses();
        updateBudgetSummary();
        showNotification('Datos reiniciados', 'Todos los gastos han sido eliminados');
    }
}

function showNotification(title, message, type = 'success') {
    // Crear notificación toast
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `
        <i class="ph ${type === 'error' ? 'ph-warning' : 'ph-check-circle'}"></i>
        <div>
            <strong>${title}</strong>
            <p>${message}</p>
        </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- EVENT LISTENERS ---

function attachEventListeners() {
    // Inputs
    els.inputs.gross.addEventListener('input', debounce(updateSalary, 300));
    els.inputs.contract.addEventListener('change', updateSalary);
    
    // Navigation
    els.nav.forEach(btn => {
        btn.addEventListener('click', () => {
            els.nav.forEach(b => b.classList.remove('active'));
            Object.values(els.views).forEach(v => v.classList.add('hidden'));
            
            btn.classList.add('active');
            const viewId = btn.dataset.view;
            els.views[viewId].classList.remove('hidden');
            
            if (viewId === 'budget') {
                updateBudgetSummary();
            }
        });
    });
    
    // Quick-amount buttons
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const amount = btn.dataset.amount;
            els.inputs.gross.value = amount;
            updateSalary();
        });
    });

    // Actions
    els.btns.addToBudget?.addEventListener('click', () => {
        const budgetBtn = Array.from(els.nav).find(b => b.dataset.view === 'budget');
        if (budgetBtn) budgetBtn.click();
    });
    
    els.btns.addExpense?.addEventListener('click', openModal);
    els.btns.closeModal?.addEventListener('click', closeModal);
    els.btns.saveExpense?.addEventListener('click', saveExpense);
    els.btns.resetData?.addEventListener('click', resetData);
    
    // Modal close on outside click
    els.modal.el?.addEventListener('click', (e) => {
        if (e.target === els.modal.el) closeModal();
    });
    
    // Enter key in modal
    els.modal.amount?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveExpense();
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// --- INIT ---

document.addEventListener('DOMContentLoaded', () => {
    initElements();
    loadFromStorage();
    
    // Set initial values from storage
    if (state.grossSalary) {
        els.inputs.gross.value = state.grossSalary;
    }
    if (state.contractType) {
        els.inputs.contract.value = state.contractType;
    }
    
    updateInfoBadge();
    updateSalary();
    renderExpenses();
    
    attachEventListeners();
    
    console.log('🚀 Presupuesto Chile v2.0.0 - 2026 Edition cargado');
    console.log('📊 Valores actualizados con datos oficiales marzo 2026');
});
