import { getStorageAdapter } from './storage';

/**
 * Generic KV Store interface for CommitLabs Backend.
 * Supports standard Redis-like operations needed for auth and rate limiting.
 * Consolidated to delegate entirely to the canonical storage adapter.
 */
export interface KVStore {
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
    del(key: string): Promise<void>;
    /**
     * Atomically gets the value and deletes the key.
     * Essential for single-use nonces to prevent replay attacks.
     */
    getdel<T>(key: string): Promise<T | null>;
    /**
     * Increments a counter and returns the new value.
     */
    incr(key: string): Promise<number>;
    /**
     * Sets a TTL on a key.
     */
    expire(key: string, seconds: number): Promise<void>;
}

class DelegatingKVStore implements KVStore {
    async get<T>(key: string): Promise<T | null> {
        return getStorageAdapter().get<T>(key);
    }

    async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
        return getStorageAdapter().set(key, value, ttlSeconds ? { ttlMs: ttlSeconds * 1000 } : undefined);
    }

    async del(key: string): Promise<void> {
        return getStorageAdapter().delete(key);
    }

    async getdel<T>(key: string): Promise<T | null> {
        return getStorageAdapter().getdel<T>(key);
    }

    async incr(key: string): Promise<number> {
        return getStorageAdapter().increment(key);
    }

    async expire(key: string, seconds: number): Promise<void> {
        return getStorageAdapter().expire(key, seconds);
    }
}

// Singleton instance
let kvInstance: KVStore;

export function getKV(): KVStore {
    if (!kvInstance) {
        kvInstance = new DelegatingKVStore();
    }
    return kvInstance;
}
