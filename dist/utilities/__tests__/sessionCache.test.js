"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const sessionCache_1 = __importStar(require("../sessionCache"));
describe("Session cache", () => {
    const uniqueSessionid = (suffix) => "unique" + suffix.toString();
    const defaultStats = {
        size: 0,
        maxSize: 1000,
        ttl: 2 * 60 * 1000,
    };
    const initialiData = {
        userId: "userId",
        email: "email",
        name: "name",
        role: "role",
        expiresAt: "08-18-2026",
        cachedAt: undefined,
    };
    //Replace the oldest data if the maxximium size exceed
    test("replace oldest data with new data if the max size exceed", () => {
        const dataToStore = Array.from({
            length: 1001,
        }).fill(initialiData);
        const CacheSession = new sessionCache_1.SessionCache();
        dataToStore.forEach((i, idx) => CacheSession.set(uniqueSessionid(idx + 1), i));
        const storedResult = CacheSession.get(uniqueSessionid(1001));
        const oldestResult = CacheSession.get(uniqueSessionid(1));
        expect(oldestResult).toBe(null);
        expect({ ...storedResult, cachedAt: undefined }).toStrictEqual(initialiData);
    });
    //completely remove the data
    test("invalidate data completely", () => {
        sessionCache_1.default.set(uniqueSessionid(1), initialiData);
        sessionCache_1.default.invalidate(uniqueSessionid(1));
        expect(sessionCache_1.default.get(uniqueSessionid(1))).toBe(null);
        sessionCache_1.default.set(uniqueSessionid(2), initialiData);
        sessionCache_1.default.set(uniqueSessionid(3), initialiData);
        expect(sessionCache_1.default.getStats()).toStrictEqual({
            ...defaultStats,
            size: 2,
        });
        sessionCache_1.default.clear();
        expect(sessionCache_1.default.getStats()).toStrictEqual(defaultStats);
        expect(sessionCache_1.default.get(uniqueSessionid(2)));
        expect(sessionCache_1.default.get(uniqueSessionid(3)));
    });
    //Expired TTL
    test("session cache should be deleted if the ttl is expried", () => {
        const cacheStation = new sessionCache_1.SessionCache();
        cacheStation.set(uniqueSessionid(1), initialiData);
        //Make ttl expired
        cacheStation.TTL = -1;
        expect(cacheStation.get(uniqueSessionid(1))).toBe(null);
        expect(cacheStation.getStats().size).toBe(0);
    });
    // Cleanup method
    test("cleanup() should remove expired entries and keep valid entries", () => {
        const cache = new sessionCache_1.SessionCache();
        cache.set(uniqueSessionid(1), initialiData);
        // Artificially age the first entry by 3 minutes (TTL is 2 minutes)
        cache.cache.get(uniqueSessionid(1)).cachedAt =
            Date.now() - 3 * 60 * 1000;
        cache.set(uniqueSessionid(2), initialiData);
        const removed = cache.cleanup();
        expect(removed).toBe(1);
        expect(cache.get(uniqueSessionid(1))).toBeNull();
        expect(cache.get(uniqueSessionid(2))).not.toBeNull();
        expect(cache.getStats().size).toBe(1);
    });
    // Periodic cleanup via setInterval
    describe("interval cleanup with fake timers", () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });
        afterEach(() => {
            jest.useRealTimers();
        });
        test("should trigger cleanup and remove expired entries when interval passes", () => {
            const cache = new sessionCache_1.SessionCache();
            const cleanupSpy = jest.spyOn(cache, "cleanup");
            const intervalId = setInterval(() => {
                cache.cleanup();
            }, 5 * 60 * 1000);
            cache.set(uniqueSessionid(1), initialiData);
            // Fast-forward 5 minutes
            jest.advanceTimersByTime(5 * 60 * 1000);
            expect(cleanupSpy).toHaveBeenCalledTimes(1);
            expect(cache.get(uniqueSessionid(1))).toBeNull();
            expect(cache.getStats().size).toBe(0);
            clearInterval(intervalId);
        });
    });
});
