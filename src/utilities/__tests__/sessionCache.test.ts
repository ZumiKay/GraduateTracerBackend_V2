import sessionCache, { CachedSession, SessionCache } from "../sessionCache";

describe("Session cache", () => {
  const uniqueSessionid = (suffix: number) => "unique" + suffix.toString();
  const defaultStats = {
    size: 0,
    maxSize: 1000,
    ttl: 2 * 60 * 1000,
  };
  const initialiData: Partial<CachedSession> = {
    userId: "userId",
    email: "email",
    name: "name",
    role: "role",
    expiresAt: "08-18-2026",
    cachedAt: undefined,
  };

  //Replace the oldest data if the maxximium size exceed
  test("replace oldest data with new data if the max size exceed", () => {
    const dataToStore: Array<Partial<CachedSession>> = Array.from({
      length: 1001,
    }).fill(initialiData) as never;
    const CacheSession = new SessionCache();
    dataToStore.forEach((i, idx) =>
      CacheSession.set(uniqueSessionid(idx + 1), i as never),
    );

    const storedResult = CacheSession.get(uniqueSessionid(1001));
    const oldestResult = CacheSession.get(uniqueSessionid(1));

    expect(oldestResult).toBe(null);
    expect({ ...storedResult, cachedAt: undefined }).toStrictEqual(
      initialiData,
    );
  });

  //completely remove the data
  test("invalidate data completely", () => {
    sessionCache.set(uniqueSessionid(1), initialiData as never);
    sessionCache.invalidate(uniqueSessionid(1));
    expect(sessionCache.get(uniqueSessionid(1))).toBe(null);

    sessionCache.set(uniqueSessionid(2), initialiData as never);
    sessionCache.set(uniqueSessionid(3), initialiData as never);
    expect(sessionCache.getStats()).toStrictEqual({
      ...defaultStats,
      size: 2,
    });
    sessionCache.clear();
    expect(sessionCache.getStats()).toStrictEqual(defaultStats);
    expect(sessionCache.get(uniqueSessionid(2)));
    expect(sessionCache.get(uniqueSessionid(3)));
  });

  //Expired TTL
  test("session cache should be deleted if the ttl is expried", () => {
    const cacheStation = new SessionCache();

    cacheStation.set(uniqueSessionid(1), initialiData as never);
    //Make ttl expired
    (cacheStation as any).TTL = -1;

    expect(cacheStation.get(uniqueSessionid(1))).toBe(null);
    expect(cacheStation.getStats().size).toBe(0);
  });

  // Cleanup method
  test("cleanup() should remove expired entries and keep valid entries", () => {
    const cache = new SessionCache();

    cache.set(uniqueSessionid(1), initialiData as never);
    // Artificially age the first entry by 3 minutes (TTL is 2 minutes)
    (cache as any).cache.get(uniqueSessionid(1)).cachedAt =
      Date.now() - 3 * 60 * 1000;

    cache.set(uniqueSessionid(2), initialiData as never);

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
      const cache = new SessionCache();
      const cleanupSpy = jest.spyOn(cache, "cleanup");

      const intervalId = setInterval(
        () => {
          cache.cleanup();
        },
        5 * 60 * 1000,
      );

      cache.set(uniqueSessionid(1), initialiData as never);

      // Fast-forward 5 minutes
      jest.advanceTimersByTime(5 * 60 * 1000);

      expect(cleanupSpy).toHaveBeenCalledTimes(1);
      expect(cache.get(uniqueSessionid(1))).toBeNull();
      expect(cache.getStats().size).toBe(0);

      clearInterval(intervalId);
    });
  });
});
