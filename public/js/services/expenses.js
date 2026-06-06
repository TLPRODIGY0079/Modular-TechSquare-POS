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
        <div class="warehouse-container">
            <div class="warehouse-header">
                <div>
                    <h1><i class="fas fa-receipt"></i> Expense Tracking</h1>
                    <p style="color:var(--tx2);margin-top:8px">Record and track business expenses</p>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:380px 1fr;gap:20px">
                <!-- Record Expense Form -->
                <div class="card">
                    <div class="card-header">
                        <h3>Record Expense</h3>
                    </div>
                    <div class="card-body">
                        <form id="expenseForm">
                            <div class="form-group">
                                <label>Store</label>
                                <select class="form-input" id="expenseStore" required>
                                    ${user.role === "admin" ? 
                                        `<option value="">Select Store</option>
                                        <option value="${STORE1_ID}">Store 1</option>
                                        <option value="${STORE2_ID}">Store 2</option>` : 
                                        `<option value="${user.storeId}">${user.storeId === STORE1_ID ? "Store 1" : "Store 2"}</option>`
                                    }
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Category</label>
                                <select class="form-input" id="expenseCategory" required>
                                    <option value="">Select category</option>
                                    <option value="rent">Rent</option>
                                    <option value="taxes">Taxes</option>
                                    <option value="in_store">In-Store</option>
                                    <option value="out_of_store">Out of Store</option>
                                    <option value="supplies">Supplies</option>
                                    <option value="salaries">Salaries</option>
                                    <option value="utilities">Utilities</option>
                                    <option value="marketing">Marketing</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Amount (K) *</label>
                                    <input type="number" class="form-input" id="expenseAmount" required min="0" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label>Date *</label>
                                    <input type="date" class="form-input" id="expenseDate" required value="${today()}">
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label>Description</label>
                                <input type="text" class="form-input" id="expenseDescription" placeholder="What was this expense for?">
                            </div>
                            
                            <div class="form-group">
                                <label>Receipt # (optional)</label>
                                <input type="text" class="form-input" id="expenseReceipt" placeholder="Receipt number">
                            </div>
                            
                            <button type="submit" class="btn btn-primary" style="width:100%">
                                <i class="fas fa-plus"></i> Record Expense
                            </button>
                        </form>
                    </div>
                </div>

                <!-- Expense History -->
                <div class="card">
                    <div class="card-header">
                        <div style="display:flex;justify-content:space-between;align-items:center">
                            <h3>Expense History</h3>
                            <div style="display:flex;gap:12px;align-items:center">
                                <div class="search-bar">
                                    <i class="fas fa-search"></i>
                                    <input type="text" class="search-input" id="expenseSearch" placeholder="Search expenses...">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="card-body np">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Store</th>
                                    <th>Category</th>
                                    <th>Amount</th>
                                    <th>Description</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="expensesTableBody">
                                <!-- Expenses will be rendered here -->
                            </tbody>
                        </table>
                        
                        <div style="margin-top:20px;padding-top:20px;border-top:1px solid var(--bd)">
                            <div style="display:flex;justify-content:space-between;align-items:center">
                                <span style="font-size:16px;font-weight:600">Total Expenses:</span>
                                <span id="totalExpenses" style="font-size:24px;font-weight:700;color:var(--dn)">K0.00</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Setup form submission
    const form = document.getElementById("expenseForm");
    if (form) {
        form.addEventListener("submit", processExpenseForm);
    }

    // Render expenses table
    renderExpensesTable();

    // Search functionality
    const searchInput = document.getElementById("expenseSearch");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const rows = document.querySelectorAll("#expensesTableBody tr");
            rows.forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(searchTerm) ? '' : 'none';
            });
        });
    }
}

// Render expenses table
function renderExpensesTable() {
    const DB = getDB();
    const tbody = document.getElementById("expensesTableBody");
    const totalElement = document.getElementById("totalExpenses");
    
    if (!tbody) return;

    const catColors = {
        rent: "badge-blue",
        taxes: "badge-red", 
        in_store: "badge-green",
        out_of_store: "badge-orange",
        supplies: "badge-purple",
        salaries: "badge-cyan",
        utilities: "badge-yellow",
        marketing: "badge-pink",
        other: "badge-gray"
    };

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

    tbody.innerHTML = sortedExpenses.slice(0, 30).map(expense => `
        <tr>
            <td>${expense.date}</td>
            <td><span class="badge ${expense.store_id === STORE1_ID ? "badge-blue" : "badge-green"}">${expense.store_id === STORE1_ID ? "Store 1" : "Store 2"}</span></td>
            <td><span class="badge ${catColors[expense.category] || "badge-gray"}">${(expense.category || "").replace(/_/g, " ")}</span></td>
            <td><strong>${money(expense.amount)}</strong></td>
            <td style="font-size:12px;color:var(--tx2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(expense.description || '-')}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="window.expensesService.deleteExpense('${expense.id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    // Calculate total
    const total = DB.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    if (totalElement) totalElement.textContent = money(total);
}

// Process expense form submission
async function processExpenseForm(e) {
    e.preventDefault();
    
    const DB = getDB();
    const sb = getSupabase();
    const user = getCurrentUser();
    
    const storeId = document.getElementById("expenseStore")?.value;
    const category = document.getElementById("expenseCategory")?.value;
    const amount = parseFloat(document.getElementById("expenseAmount")?.value);
    const date = document.getElementById("expenseDate")?.value;
    const description = document.getElementById("expenseDescription")?.value.trim();
    const receiptNumber = document.getElementById("expenseReceipt")?.value.trim();

    if (!storeId || !category || !amount || !date) {
        toast("Please fill in all required fields", "error");
        return;
    }

    if (amount <= 0) {
        toast("Amount must be greater than 0", "error");
        return;
    }

    try {
        const expenseData = {
            id: uid(),
            store_id: storeId,
            user_id: user?.id,
            user_name: user?.name,
            category: category,
            amount: amount,
            description: description,
            date: date,
            receipt_number: receiptNumber || null,
            created_at: now()
        };

        // Save to Supabase
        if (sb) {
            const { error } = await sb.from("expenses").insert([expenseData]);
            if (error) throw error;
        }

        // Save to local DB
        DB.expenses.unshift(expenseData);

        // Clear form
        document.getElementById("expenseForm").reset();
        document.getElementById("expenseDate").value = today();

        // Re-render table
        renderExpensesTable();

        toast("Expense recorded successfully", "success");
    } catch (error) {
        console.error("Error saving expense:", error);
        toast("Error saving expense: " + error.message, "error");
    }
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
    deleteExpense,
    processExpenseForm
};

// Make functions available globally for onclick handlers
if (typeof window !== 'undefined') {
    window.expensesService = expensesService;
}

export default expensesService;