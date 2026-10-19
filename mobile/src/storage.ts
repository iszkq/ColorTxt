import type { Book, Settings } from './core';
let database: Promise<IDBDatabase> | undefined;
function getDatabase() { return database ??= new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('colortxt-mobile', 1);
  request.onupgradeneeded = () => { const db = request.result; db.createObjectStore('books', { keyPath: 'id' }); db.createObjectStore('settings'); };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error('无法打开本地书库，请确认设备有可用存储空间。'));
}); }
async function run<T>(store: string, mode: IDBTransactionMode, operation: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode); const req = operation(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = tx.onabort = () => reject(new Error('本地保存失败，请释放存储空间后重试。'));
  });
}
export const loadBooks = () => run<Book[]>('books','readonly', s => s.getAll());
export const saveBook = (book: Book) => run('books','readwrite', s => s.put(JSON.parse(JSON.stringify(book))));
export const removeBook = (id: string) => run('books','readwrite', s => s.delete(id));
export const loadSettings = () => run<Settings | undefined>('settings','readonly', s => s.get('reader'));
export const saveSettings = (settings: Settings) => run('settings','readwrite', s => s.put(JSON.parse(JSON.stringify(settings)), 'reader'));
