# Agent Inventory Flow Analysis

## Current Implementation Analysis

Based on the code analysis of the agent assignment system, here's what happens:

### 1. When Product is Assigned to Agent
**Function**: `assignProductToAgent()` (lines 1059-1171)

**Inventory Deduction**: ✅ **IMMEDIATE** at assignment time

**Code Evidence** (lines 1137-1162):
```javascript
// Deduct from inventory
const newQty = variant.qty - qty;  // Line 1138
const variantUpdate = {
    qty: newQty,
    updated_at: now()
};

if (sb) {
    try {
        const { error: variantError } = await sb.from("variants").update(variantUpdate).eq("id", variantId);
        if (variantError) throw variantError;
    } catch (supabaseError) {
        // Queue for offline sync
        const offlineDB = window.offlineDB;
        if (offlineDB) {
            await offlineDB.queueOperation('update', 'variants', variantUpdate, variantId);
        }
    }
}

// Always update local variant
const variantIndex = DB.variants.findIndex(v => v.id === variantId);
if (variantIndex !== -1) {
    DB.variants[variantIndex].qty = newQty;  // Line 1161
}
```

**What Happens**:
- When you assign a product to an agent, the inventory is **immediately deducted**
- Stock quantity is reduced by the assigned quantity
- This happens at the moment the assignment is created
- NOT when the agent brings cash

---

### 2. When Assignment is Completed
**Function**: `completeAgentAssignment()` (lines 1218-1323)

**Inventory Restoration**: ❌ **NO inventory is added back**

**Code Evidence** (lines 1218-1323):
```javascript
// Create sales record for the completed assignment
const receiptNumber = "AGENT-" + String((DB.sales || []).length + 1).padStart(5, "0");
const saleData = {
    id: uid(),
    store_id: assignment.store_id,
    user_id: currentUser.id,
    user_name: currentUser.name,
    receipt_number: receiptNumber,
    product_name: assignment.product_name,
    sku: assignment.sku,
    variant_label: assignment.variant_label,
    quantity: assignment.qty,
    unit_price: assignment.agreed_amount / assignment.qty,
    cost_price: 0,
    total: assignment.agreed_amount,
    profit: assignment.agreed_amount,
    payment_method: "agent",
    customer_name: `Agent: ${assignment.agent_id}`,
    date_str: today(),
    created_at: now()
};

// Save sale to Supabase (if online)
if (sb) {
    try {
        const { error: saleError } = await sb.from("sales").insert([saleData]);
        if (saleError) throw saleError;
    } catch (supabaseError) {
        // Save to IndexedDB for offline sync
        const offlineDB = window.offlineDB;
        if (offlineDB) {
            await offlineDB.put('sales', saleData);
            await offlineDB.queueOperation('create', 'sales', saleData, saleData.id);
        }
    }
}

// Update assignment status
const updates = {
    status: 'completed',
    completed_at: now(),
    payment_date: today(),
    updated_at: now()
};

if (sb) {
    try {
        const { error: assignError } = await sb.from("agent_assignments").update(updates).eq("id", assignmentId);
        if (assignError) throw assignError;
    } catch (supabaseError) {
        // Queue for offline sync
        const offlineDB = window.offlineDB;
        if (offlineDB) {
            await offlineDB.queueOperation('update', 'agent_assignments', updates, assignmentId);
        }
    }
}
```

**What Happens**:
- Creates a sales record for the agreed amount
- Updates assignment status to 'completed'
- Records completion date and payment date
- **NO inventory is added back** when completed
- The product was already deducted at assignment time

---

### 3. When Completed Assignments Show
**Function**: `renderAgentAssignments()` (lines 1334-1451)

**Display Logic** (lines 1345-1348):
```javascript
const activeAssignments = assignments.filter(a => a.status !== 'completed');
const completedAssignments = assignments.filter(a => a.status === 'completed');
```

**What Shows**:
- Active assignments show in "Active Assignments" table
- Completed assignments show in "Completed Assignments" table
- Completed table shows: product, agent, date taken, completion date, amount, status

---

## Summary of Current Flow

### Current Inventory Timing:
1. **Assignment Creation**: ❌ **Inventory deducted immediately** (when agent gets product)
2. **Agent Brings Cash**: ✅ Assignment marked complete, **no inventory change**
3. **Assignment Completion**: ✅ Sale recorded, **inventory not restored**

### Business Logic Implications:
- **Consignment Model**: Products are treated as "sold" when given to agents
- **Revenue Recognition**: Revenue recognized when agent completes assignment (brings cash)
- **Inventory Tracking**: Inventory shows what's physically in store, not what's with agents
- **Risk**: If agent doesn't complete assignment, inventory still shows as deducted

---

## Potential Issues with Current Implementation

### 1. Inventory Inaccuracy
- Store inventory shows less than what's actually available
- Doesn't account for products currently with agents
- Makes inventory planning difficult

### 2. Sales Data Inconsistency  
- Sales are recorded when agent brings cash, not when customer actually buys
- Timing mismatch between actual sale and recorded sale
- Revenue recognition timing issues

### 3. Agent Risk Management
- No tracking of what agents currently have
- If agent disappears, product is still deducted from inventory
- No way to recover uncompleted assignments

---

## Recommended Improvements

### Option 1: Separate Agent Inventory
- Create separate tracking for agent-held inventory
- Keep store inventory accurate
- Track products currently with agents
- Add agent inventory to dashboard

### Option 2: Conditional Deduction  
- Don't deduct inventory at assignment
- Deduct only when assignment is completed
- Track "out for consignment" status
- Better inventory accuracy

### Option 3: Two-Step Inventory System
- Deduct to "agent consignment" inventory at assignment
- Deduct from "store inventory" only when completed
- Maintain separate inventory pools
- More complex but most accurate

---

## Current Status

**Answer to Your Questions:**
- **When inventory is deducted**: The moment the agent gets the product (assignment creation)
- **When inventory is restored**: Never - it stays deducted permanently
- **Completed Assignments show**: When assignment status is changed to 'completed'
- **What happens at completion**: Sale is recorded, assignment marked complete, no inventory change

The current system treats agent assignments as immediate sales for inventory purposes, which may not match the actual business logic of consignment.