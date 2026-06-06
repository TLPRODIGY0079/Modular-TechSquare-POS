// Offline Database Module using IndexedDB
// This provides offline storage and sync capabilities for TECHSQUARE POS

class OfflineDB {
    constructor() {
        this.dbName = 'TechSquarePOS';
        this.dbVersion = 2; // Incremented to trigger schema update
        this.db = null;
        this.syncQueue = [];
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const currentVersion = event.oldVersion;

                // Migration from version 1 to 2: rename stores from camelCase to snake_case
                if (currentVersion < 2) {
                    // Delete old camelCase stores if they exist
                    const oldStores = ['serializedItems', 'stockTransfers', 'tradeIns', 'laybys', 'laybyPayments', 'commissionRecords'];
                    oldStores.forEach(storeName => {
                        if (db.objectStoreNames.contains(storeName)) {
                            db.deleteObjectStore(storeName);
                        }
                    });
                }

                // Create object stores with snake_case names
                if (!db.objectStoreNames.contains('products')) {
                    db.createObjectStore('products', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('variants')) {
                    db.createObjectStore('variants', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('serialized_items')) {
                    db.createObjectStore('serialized_items', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('sales')) {
                    db.createObjectStore('sales', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('stock_transfers')) {
                    db.createObjectStore('stock_transfers', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('trade_in_transactions')) {
                    db.createObjectStore('trade_in_transactions', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('expenses')) {
                    db.createObjectStore('expenses', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('layby_transactions')) {
                    db.createObjectStore('layby_transactions', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('layby_payments')) {
                    db.createObjectStore('layby_payments', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('commission_records')) {
                    db.createObjectStore('commission_records', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('stock_requests')) {
                    db.createObjectStore('stock_requests', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('sync_queue')) {
                    db.createObjectStore('sync_queue', { keyPath: 'id' });
                }
            };
        });
    }

    async get(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async queueOperation(operation, table, data, recordId = null) {
        const queueItem = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            operation,
            table,
            data,
            recordId,
            timestamp: new Date().toISOString()
        };

        this.syncQueue.push(queueItem);
        await this.put('sync_queue', queueItem);
    }

    async processSyncQueue() {
        if (this.syncQueue.length === 0) {
            this.syncQueue = await this.getAll('sync_queue');
        }

        if (this.syncQueue.length === 0) return;

        // This would integrate with the Supabase sync functionality
        // For now, just clear processed items
        for (const item of this.syncQueue) {
            await this.delete('sync_queue', item.id);
        }

        this.syncQueue = [];
    }
}

// Initialize the offline database
window.offlineDB = new OfflineDB();

// Auto-initialize when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            await window.offlineDB.init();
            console.log('✅ OfflineDB initialized successfully');
        } catch (error) {
            console.error('❌ OfflineDB initialization failed:', error);
        }
    });
} else {
    window.offlineDB.init().then(() => {
        console.log('✅ OfflineDB initialized successfully');
    }).catch(error => {
        console.error('❌ OfflineDB initialization failed:', error);
    });
}