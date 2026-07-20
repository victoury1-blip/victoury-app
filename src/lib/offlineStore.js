import { openDB } from 'idb';

const DB_NAME = 'victoury-offline';
const DB_VERSION = 1;

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('orders')) {
        db.createObjectStore('orders', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        const store = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp');
      }
    },
  });
}

// Save orders to IndexedDB for offline access
export async function saveOrdersOffline(orders) {
  const db = await getDb();
  const tx = db.transaction('orders', 'readwrite');
  for (const order of orders) {
    await tx.store.put(order);
  }
  await tx.done;
}

// Load orders from IndexedDB (for offline use)
export async function loadOrdersOffline() {
  const db = await getDb();
  return db.getAll('orders');
}

// Queue a change for sync when back online
export async function queueSync(action, data) {
  const db = await getDb();
  await db.add('syncQueue', {
    action,  // 'update', 'delete', 'create'
    data,
    timestamp: Date.now(),
  });
}

// Get all pending sync items
export async function getPendingSync() {
  const db = await getDb();
  return db.getAll('syncQueue');
}

// Clear sync queue after successful sync
export async function clearSyncQueue() {
  const db = await getDb();
  const tx = db.transaction('syncQueue', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

// Delete a single sync-queue item by its autoIncrement id (used to remove only the
// items that were successfully replayed, so failed/new ones survive for the next flush).
export async function deleteSyncItem(id) {
  const db = await getDb();
  await db.delete('syncQueue', id);
}

// Delete an order from IndexedDB
export async function deleteOrderOffline(orderId) {
  const db = await getDb();
  await db.delete('orders', orderId);
}
