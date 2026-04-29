"use strict";
/**
 * In-memory cache for session data to reduce database queries
 * Optimized for frequent CheckSession calls
 */
Object.defineProperty(exports, "__esModule", { value: true });
class SessionCache {
    constructor() {
        this.cache = new Map();
        this.TTL = 2 * 60 * 1000; // 2 minutes TTL
        this.MAX_SIZE = 1000; // Maximum cache size
    }
    /**
     * Get cached session data
     */
    get(sessionId) {
        const cached = this.cache.get(sessionId);
        if (!cached) {
            return null;
        }
        // Check if cache entry is still valid
        const now = Date.now();
        if (now - cached.cachedAt > this.TTL) {
            this.cache.delete(sessionId);
            return null;
        }
        return cached;
    }
    /**
     * Set session data in cache
     */
    set(sessionId, data) {
        // Implement LRU-style eviction if cache is full
        if (this.cache.size >= this.MAX_SIZE) {
            // Remove oldest entry
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(sessionId, Object.assign(Object.assign({}, data), { cachedAt: Date.now() }));
    }
    /**
     * Invalidate a specific session
     */
    invalidate(sessionId) {
        this.cache.delete(sessionId);
    }
    /**
     * Clear all cached sessions
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.MAX_SIZE,
            ttl: this.TTL,
        };
    }
    /**
     * Cleanup expired entries (run periodically)
     */
    cleanup() {
        const now = Date.now();
        let removed = 0;
        for (const [key, value] of this.cache.entries()) {
            if (now - value.cachedAt > this.TTL) {
                this.cache.delete(key);
                removed++;
            }
        }
        return removed;
    }
}
// Singleton instance
const sessionCache = new SessionCache();
// Run cleanup every 5 minutes
setInterval(() => {
    const removed = sessionCache.cleanup();
    if (removed > 0) {
        console.log(`[SessionCache] Cleaned up ${removed} expired entries`);
    }
}, 5 * 60 * 1000);
exports.default = sessionCache;
