/**
 * 单机模式的本地存储
 *
 * 单机版没有数据库进程，所有数据存在设备上：
 * - 有 IndexedDB 就用 IndexedDB（容量大，能存图片）
 * - 没有就退回 localStorage（容量小，只作为兜底）
 *
 * 写操作串行化：多个页面同时写同一份数据时，后写的覆盖先写的，
 * 但不会出现"读-改-写"交错导致的丢失。
 */

const DB_NAME = "mindscape";
const DB_VERSION = 1;
const STORE = "kv";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    // 某些浏览器会在隐私模式下直接阻塞，不能无限等
    setTimeout(() => resolve(null), 3000);
  });

  return dbPromise;
}

function lsKey(key: string) {
  return `mindscape:${key}`;
}

/** 读。没有该键时返回 fallback，不会抛错 */
export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const db = await openDB();

  if (!db) {
    try {
      const raw = localStorage.getItem(lsKey(key));
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result === undefined ? fallback : (req.result as T));
      req.onerror = () => resolve(fallback);
    } catch {
      resolve(fallback);
    }
  });
}

/** 写 */
export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();

  if (!db) {
    try {
      localStorage.setItem(lsKey(key), JSON.stringify(value));
    } catch {
      // 容量超限：静默失败，调用方会在下一次读取时看到旧值
    }
    return;
  }

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** 读-改-写。所有变更都走这里，避免交错覆盖 */
let queue: Promise<unknown> = Promise.resolve();

export function kvUpdate<T>(key: string, fn: (current: T | undefined) => T): Promise<T> {
  const run = queue.then(async () => {
    const current = await kvGet<T | undefined>(key, undefined);
    const next = fn(current);
    await kvSet(key, next);
    return next;
  });
  // 队列不能因为一次失败就卡死
  queue = run.catch(() => undefined);
  return run;
}

/** 清空全部本地数据（「清空」按钮用） */
export async function kvClearAll(keys: string[]): Promise<void> {
  for (const key of keys) {
    await kvSet(key, null);
    try {
      localStorage.removeItem(lsKey(key));
    } catch {}
  }
}

/** 导出全部数据用 */
export async function kvDump(keys: string[]): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[key] = await kvGet(key, null);
  }
  return out;
}
