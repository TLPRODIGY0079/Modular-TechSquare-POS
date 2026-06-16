# Agent Performance Card - Surgical Fix

## Problem Identified
The "Agent Performance" card in the admin dashboard was not showing any data even though there were agent transactions in the Agents page.

## Root Causes Found

1. **Missing getGlobalMetrics Function**: The `loadAgentMetrics()` function was calling `window.getGlobalMetrics()` which didn't exist
2. **Incorrect Element IDs**: The dashboard used `agentMetrics` div ID but the code was looking for `agentMetricsWidget`
3. **No Data Structure**: The card had no HTML structure to display metrics
4. **No Error Handling**: The function silently failed when dependencies were missing

## Surgical Fixes Applied

### 1. Implemented getGlobalMetrics Function (agents.js lines 777-825)
**Added:**
```javascript
async function getGlobalMetrics(storeId = null) {
    const DB = getDB();
    
    // Filter assignments by store if storeId is provided
    const assignments = storeId 
        ? (DB.agentAssignments || []).filter(a => a.store_id === storeId)
        : (DB.agentAssignments || []);
    
    const agents = DB.agents || [];
    
    // Calculate metrics
    const totalAgents = agents.length;
    
    // Calculate total owed (sum of agreed amounts for active assignments)
    const totalOwed = assignments
        .filter(a => a.status === 'active')
        .reduce((sum, a) => sum + (a.agreed_amount || 0), 0);
    
    // Calculate total collected (sum of agreed amounts for completed assignments)
    const totalCollected = assignments
        .filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + (a.agreed_amount || 0), 0);
    
    // Calculate outstanding (active assignments)
    const totalOutstanding = totalOwed;
    
    // Find top agent by total sales
    let topAgent = null;
    if (assignments.length > 0) {
        // Group assignments by agent
        const agentPerformance = new Map();
        
        assignments.forEach(assignment => {
            const agentId = assignment.agent_id;
            if (!agentPerformance.has(agentId)) {
                const agent = agents.find(a => a.id === agentId);
                agentPerformance.set(agentId, {
                    name: agent?.name || 'Unknown',
                    totalSales: 0,
                    totalProfit: 0,
                    completedAssignments: 0
                });
            }
            
            const perf = agentPerformance.get(agentId);
            if (assignment.status === 'completed') {
                perf.totalSales += 1;
                perf.totalProfit += (assignment.agreed_amount || 0);
                perf.completedAssignments += 1;
            }
        });
        
        // Find top performer
        let maxSales = 0;
        agentPerformance.forEach((perf) => {
            if (perf.totalSales > maxSales) {
                maxSales = perf.totalSales;
                topAgent = perf;
            }
        });
    }
    
    return {
        totalAgents,
        totalOwed,
        totalCollected,
        totalOutstanding,
        topAgent
    };
}
```

**Why**: Provides the missing function that calculates agent metrics from actual database data (agents and agent_assignments tables)

### 2. Fixed Dashboard HTML Structure (dashboard.js lines 108-145)
**Before:**
```html
<div class="card">
    <div class="card-header">
        <h3 style="font-size: 16px; font-weight: 700;">Agent Performance</h3>
    </div>
    <div class="card-body">
        <div id="agentMetrics">
            <!-- Agent metrics will be rendered here -->
        </div>
    </div>
</div>
```

**After:**
```html
<div class="card" id="agentMetricsWidget" style="display: none;">
    <div class="card-header">
        <h3 style="font-size: 16px; font-weight: 700;">Agent Performance</h3>
    </div>
    <div class="card-body">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            <div style="text-align: center; padding: 16px; background: var(--bg); border-radius: 8px;">
                <div style="font-size: 12px; color: var(--tx2); margin-bottom: 8px;">Total Owed</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--ac);" id="agentTotalOwed">K0.00</div>
            </div>
            <div style="text-align: center; padding: 16px; background: var(--bg); border-radius: 8px;">
                <div style="font-size: 12px; color: var(--tx2); margin-bottom: 8px;">Total Collected</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--gn);" id="agentTotalCollected">K0.00</div>
            </div>
            <div style="text-align: center; padding: 16px; background: var(--bg); border-radius: 8px;">
                <div style="font-size: 12px; color: var(--tx2); margin-bottom: 8px;">Outstanding</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--wn);" id="agentTotalOutstanding">K0.00</div>
            </div>
        </div>
        
        <div id="topAgentCard" style="display: none; margin-top: 16px; padding: 16px; background: var(--ac3); border-radius: 8px; border-left: 4px solid var(--ac);">
            <div style="font-size: 12px; color: var(--ac); font-weight: 600; margin-bottom: 8px;">🏆 Top Performer</div>
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="flex: 1;">
                    <div style="font-size: 14px; font-weight: 700;" id="topAgentName">-</div>
                    <div style="font-size: 12px; color: var(--tx2);">Sales: <span id="topAgentSales">0</span></div>
                </div>
                <div style="font-size: 18px; font-weight: 700; color: var(--ac);" id="topAgentProfit">K0.00</div>
            </div>
        </div>
        
        <div id="noAgentData" style="display: none; text-align: center; padding: 32px; color: var(--tx3);">
            <i class="fas fa-user-tie" style="font-size: 32px; margin-bottom: 12px; opacity: 0.3;"></i>
            <div style="font-size: 14px;">No agent data available</div>
            <div style="font-size: 12px;">Agent transactions will appear here</div>
        </div>
    </div>
</div>
```

**Why**: Provides the correct element IDs and HTML structure that loadAgentMetrics expects, with proper display states and fallback UI

### 3. Enhanced loadAgentMetrics Function (agents.js lines 827-936)
**Before:** Called missing `window.getGlobalMetrics()` with no fallback
**After:** Uses locally implemented `getGlobalMetrics()` with comprehensive error handling

**Enhanced Features:**
- ✅ Uses local `getGlobalMetrics()` function instead of missing global
- ✅ Shows widget when there are agents or assignments
- ✅ Displays "no data" message when appropriate
- ✅ Shows top performer when available
- ✅ Hides top performer card when no data
- ✅ Comprehensive error handling with fallback UI
- ✅ Debug logging for troubleshooting

### 4. Updated Exports (agents.js lines 1459-1509)
**Added to exports:**
- `getGlobalMetrics` to agentsService object
- Named exports for better module compatibility
- Made function globally available via `window.getGlobalMetrics`

**Why**: Ensures the function is properly exported and accessible where needed

## What the Fix Does

Now the Agent Performance card will:
- ✅ Show agent metrics when there are agent assignments
- ✅ Display total owed, collected, and outstanding amounts
- ✅ Show top performing agent with their sales and profit
- ✅ Show helpful message when no agent data exists
- ✅ Work for both admin (all stores) and cashier (their store only)
- ✅ Calculate metrics from actual database data
- ✅ Handle errors gracefully with appropriate fallback UI

## Data Flow

1. **Dashboard loads** → Calls `loadAgentMetrics()`
2. **loadAgentMetrics()** → Calls `getGlobalMetrics(storeId)`
3. **getGlobalMetrics()** → Queries DB.agents and DB.agentAssignments
4. **Calculations** → Computes totals and finds top performer
5. **UI Update** → Updates dashboard card with calculated metrics
6. **Fallback** → Shows "no data" message if no agent activity

## Metrics Calculated

- **Total Owed**: Sum of agreed amounts for all active assignments
- **Total Collected**: Sum of agreed amounts for completed assignments  
- **Outstanding**: Same as total owed (active assignments)
- **Top Agent**: Agent with most completed assignments by sales count
- **Total Agents**: Count of all agents in system

## Testing Recommendations

1. **Create Agent Assignment**:
   - Go to Agents page
   - Create an agent (if none exists)
   - Assign a product to an agent
   
2. **Complete Assignment**:
   - Go to Agent Assignments
   - Complete an assignment to generate transaction data
   
3. **Check Dashboard**:
   - Go to Dashboard
   - Verify Agent Performance card shows updated metrics
   - Check that totals reflect the assignments

4. **Test Empty State**:
   - Clear agent assignments for testing
   - Verify "No agent data available" message appears
   - Ensure card handles missing data gracefully

## Expected Behavior After Fix

The Agent Performance card will now:
- ✅ Display when there are agent assignments
- ✅ Show accurate financial metrics (owed, collected, outstanding)
- ✅ Highlight top performing agent
- ✅ Show helpful message when no data exists
- ✅ Update automatically when dashboard loads
- ✅ Work correctly for both admin and cashier roles
- ✅ Provide debug logging for troubleshooting

**Status**: ✅ Surgical fix applied and ready for testing