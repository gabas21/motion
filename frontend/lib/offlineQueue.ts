const DB_NAME = 'motion-offline-db';
const STORE_NAME = 'task-queue';

export async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return reject('IndexedDB is not supported');
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject(e);
  });
}

export async function queueOfflineTask(taskData: object): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add({ taskData, createdAt: new Date().toISOString() });
  } catch (err) {
    console.error('Failed to queue offline task:', err);
  }
}

export async function flushOfflineQueue(apiPost: (data: object) => Promise<any>): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    return new Promise((resolve) => {
      req.onsuccess = async () => {
        const items = req.result || [];
        let flushedCount = 0;
        for (const item of items) {
          try {
            await apiPost(item.taskData);
            const delTx = db.transaction(STORE_NAME, 'readwrite');
            delTx.objectStore(STORE_NAME).delete(item.id);
            flushedCount++;
          } catch (err) {
            console.error('Error syncing offline task:', err);
          }
        }
        resolve(flushedCount);
      };
      req.onerror = () => resolve(0);
    });
  } catch (err) {
    console.error('Failed to flush offline queue:', err);
    return 0;
  }
}
