// Expenses Service for TECHSQUARE POS
import { getDB, getCurrentUser } from '../db.js';
import { getSupabase } from '../supabase-client.js';
import { $, uid, money, today, now, esc } from '../utils.js';
import { openModal, closeModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { STORE1_ID, STORE2_ID, WAREHOUSE_ID } from '../config.js';

// Render expenses page
export function renderExpenses() {
    const DB = getDB();
    const user = getCurrentUser();
    const mainContent = $("mainContent");
    
    if (!mainContent) return;

    mainContent.innerHTML = `
        <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
            <h2 style="font-size: 24px; font-weight: 700;">Expense Tracking</h2>
            <button class="btn btn-primary" id="addExpenseBtn" style="width: auto;">
                <i class="fas fa-plus"></i> Add Expense
            </button>
        </div>

        <div class="card">
            <div class="card-body">
                <div class="search-bar">
                    <i class="fas fa-search"></i>
                    <input type="text" class="search-input" id="expenseSearch" placeholder="Search expenses...">
                    <input type="date" class="form-input" id="expenseDateFilter" style="width: auto;">
                    <select class="filter-select" id="expenseCategoryFilter">
                        <option value="">All Categories</option>
                        <option value="Rent">Rent</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Supplies">Supplies</option>
                        <option value="Salaries">Salaries</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Other">Other</option>
                    </select>
                </div>

                <div style="margin-top: 20px; overflow-x: auto;">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Category</th>
                                <th>Description</th>
                                <th>Amount</th>
                                <th>Recorded By</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="expensesTableBody">
                            <!-- Expenses will be rendered here -->
                        </tbody>
                    </table>
                </div>
                
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--bd);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 16px; font-weight: 600;">Total Expenses:</span>
                        <span id="totalExpenses" style="font-size: 24px; font-weight: 700; color: var(--dn);">K0.00</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Setup event listeners
    const addExpenseBtn = document.getElementById("addExpenseBtn");
    if (addExpenseBtn) {
        addExpenseBtn.addEventListener("click", () => openExpenseModal());
    }

    // Render expenses table
    renderExpensesTable();
}

// Render expenses table
function renderExpensesTable() {
    const DB = getDB();
    const tbody = document.getElementById("expensesTableBody");
    const totalElement = document.getElementById("totalExpenses");
    
    if (!tbody) return;

    if (DB.expenses.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <div class="empty-state">
                        <i class="fas fa-receipt"></i>
                        <h3>No expenses recorded</h3>
                        <p>Start tracking your business expenses</p>
                    </div>
                </td>
            </tr>
        `;
        if (totalElement) totalElement.textContent = money(0);
        return;
    }

    // Sort by date descending
    const sortedExpenses = [...DB.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = sortedExpenses.map(expense => `
        <tr>
            <td>${expense.date}</td>
            <td><span class="badge badge-blue">${esc(expense.category)}</span></td>
            <td>${esc(expense.description || '-')}</td>
            <td><strong>${money(expense.amount)}</strong></td>
            <td>${esc(expense.user_name || '-')}</td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="window.expensesService.editExpense('${expense.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="window.expensesService.deleteExpense('${expense.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    // Calculate total
    const total = DB.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    if (totalElement) totalElement.textContent = money(total);
}

// Open expense modal
function openExpenseModal(expenseId = null) {
    const DB = getDB();
    const user = getCurrentUser();
    const expense = expenseId ? DB.expenses.find(e => e.id === expenseId) : null;
    
    openModal(
        expense ? 'Edit Expense' : 'Add Expense',
        `
            <form id="expenseForm">
                <div class="form-group">
                    <label>Date *</label>
                    <input type="date" class="form-input" id="expenseDate" required value="${expense?.date || today()}">
                </div>
                <div class="form-group">
                    <label>Category *</label>
                    <select class="form-input" id="expenseCategory" required>
                        <option value="">Select category</option>
                        <option value="Rent" ${expense?.category === 'Rent' ? 'selected' : ''}>Rent</option>
                        <option value="Utilities" ${expense?.category === 'Utilities' ? 'selected' : ''}>Utilities</option>
                        <option value="Supplies" ${expense?.category === 'Supplies' ? 'selected' : ''}>Supplies</option>
                        <option value="Salaries" ${expense?.category === 'Salaries' ? 'selected' : ''}>Salaries</option>
                        <option value="Marketing" ${expense?.category === 'Marketing' ? 'selected' : ''}>Marketing</option>
                        <option value="Other" ${expense?.category === 'Other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Amount *</label>
                    <input type="number" class="form-input" id="expenseAmount" required step="0.01" min="0" value="${expense?.amount || ''}">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea class="form-input" id="expenseDescription" rows="3">${expense?.description || ''}</textarea>
                </div>
            </form>
        `,
        `
            <button class="btn btn-outline" onclick="window.closeModal()">Cancel</button>
            <button class="btn btn-primary" id="saveExpenseBtn">
                <i class="fas fa-save"></i> ${expense ? 'Update' : 'Create'} Expense
            </button>
        `
    );

    const saveBtn = document.getElementById("saveExpenseBtn");
    if (saveBtn) {
        saveBtn.addEventListener("click", () => saveExpense(expenseId));
    }
}

// Save expense
async function saveExpense(expenseId = null) {
    const DB = getDB();
    const sb = getSupabase();
    const user = getCurrentUser();
    
    const date = document.getElementById("expenseDate").value;
    const category = document.getElementById("expenseCategory").value;
    const amount = parseFloat(document.getElementById("expenseAmount").value);
    const description = document.getElementById("expenseDescription").value.trim();

    if (!date || !category || !amount) {
        toast("Please fill in all required fields", "error");
        return;
    }

    try {
        const expenseData = {
            store_id: user?.storeId || STORE1_ID,
            user_id: user?.id,
            user_name: user?.name,
            date: date,
            category: category,
            amount: amount,
            description: description,
            created_at: now()
        };

        if (expenseId) {
            // Update existing expense
            if (sb) {
                const { error } = await sb.from("expenses").update(expenseData).eq("id", expenseId);
                if (error) throw error;
            }
            
            const index = DB.expenses.findIndex(e => e.id === expenseId);
            if (index !== -1) {
                DB.expenses[index] = { ...DB.expenses[index], ...expenseData };
            }
            
            toast("Expense updated successfully", "success");
        } else {
            // Create new expense
            expenseData.id = uid();
            
            if (sb) {
                const { error } = await sb.from("expenses").insert([expenseData]);
                if (error) throw error;
            }
            
            DB.expenses.unshift(expenseData);
            toast("Expense created successfully", "success");
        }

        closeModal();
        renderExpensesTable();
    } catch (error) {
        console.error("Error saving expense:", error);
        toast("Error saving expense: " + error.message, "error");
    }
}

// Edit expense
function editExpense(expenseId) {
    openExpenseModal(expenseId);
}

// Delete expense
async function deleteExpense(expenseId) {
    const DB = getDB();
    const sb = getSupabase();
    
    showConfirm("Are you sure you want to delete this expense?", async () => {
        try {
            if (sb) {
                const { error } = await sb.from("expenses").delete().eq("id", expenseId);
                if (error) throw error;
            }
            
            const index = DB.expenses.findIndex(e => e.id === expenseId);
            if (index !== -1) {
                DB.expenses.splice(index, 1);
            }
            
            toast("Expense deleted successfully", "success");
            renderExpensesTable();
        } catch (error) {
            console.error("Error deleting expense:", error);
            toast("Error deleting expense: " + error.message, "error");
        }
    });
}

// Export service functions for global access
const expensesService = {
    renderExpenses,
    editExpense,
    deleteExpense
};

// Make functions available globally for onclick handlers
if (typeof window !== 'undefined') {
    window.expensesService = expensesService;
}

export default expensesService;