import { Redis } from "@upstash/redis";
import { config } from "./index";
import { logger } from "../utils/logger";

let redisClient: Redis | null = null;

// Only initialize if Upstash credentials are provided
if (config.UPSTASH_REDIS_REST_URL && config.UPSTASH_REDIS_REST_TOKEN) {
  redisClient = new Redis({
    url: config.UPSTASH_REDIS_REST_URL,
    token: config.UPSTASH_REDIS_REST_TOKEN,
  });
  logger.info("✅ Upstash Redis client initialized");
} else {
  logger.warn("⚠️  Upstash Redis not configured — falling back to in-memory cache");
}

// ─── In-Memory Fallback (for local dev without Redis) ─────────────────────────
const memoryCache = new Map<string, { value: string; expiresAt: number }>();

function cleanMemoryCache() {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt < now) memoryCache.delete(key);
  }
}

// Clean expired keys every 60 seconds
setInterval(cleanMemoryCache, 60_000);

// ─── Unified Cache Interface ───────────────────────────────────────────────────

export const cache = {
  async get(key: string): Promise<string | null> {
    try {
      if (redisClient) {
        return await redisClient.get<string>(key);
      }
      const entry = memoryCache.get(key);
      if (!entry) return null;
      if (entry.expiresAt < Date.now()) {
        memoryCache.delete(key);
        return null;
      }
      return entry.value;
    } catch (err) {
      logger.error("Cache GET error:", err);
      return null;
    }
  },

  async set(key: string, value: string, ttlSeconds = 3600): Promise<void> {
    try {
      if (redisClient) {
        await redisClient.setex(key, ttlSeconds, value);
        return;
      }
      memoryCache.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    } catch (err) {
      logger.error("Cache SET error:", err);
    }
  },

  async del(key: string): Promise<void> {
    try {
      if (redisClient) {
        await redisClient.del(key);
        return;
      }
      memoryCache.delete(key);
    } catch (err) {
      logger.error("Cache DEL error:", err);
    }
  },

  async delPattern(pattern: string): Promise<void> {
    try {
      if (redisClient) {
        // Upstash free tier doesn't support SCAN — use key naming convention
        // and delete specifically known keys instead
        logger.warn("Pattern delete not supported on Upstash free tier, use specific keys");
        return;
      }
      const regex = new RegExp(pattern.replace("*", ".*"));
      for (const key of memoryCache.keys()) {
        if (regex.test(key)) memoryCache.delete(key);
      }
    } catch (err) {
      logger.error("Cache DEL pattern error:", err);
    }
  },

  async exists(key: string): Promise<boolean> {
    try {
      if (redisClient) {
        const result = await redisClient.exists(key);
        return result === 1;
      }
      const entry = memoryCache.get(key);
      return !!entry && entry.expiresAt > Date.now();
    } catch (err) {
      logger.error("Cache EXISTS error:", err);
      return false;
    }
  },

  async incr(key: string): Promise<number> {
    try {
      if (redisClient) {
        return await redisClient.incr(key);
      }
      const entry = memoryCache.get(key);
      const current = entry ? parseInt(entry.value, 10) : 0;
      const next = current + 1;
      memoryCache.set(key, {
        value: String(next),
        expiresAt: entry?.expiresAt ?? Date.now() + 3600_000,
      });
      return next;
    } catch (err) {
      logger.error("Cache INCR error:", err);
      return 0;
    }
  },

  // Refresh token management
  async addToBlacklist(token: string, ttlSeconds: number): Promise<void> {
    await this.set(`blacklist:${token}`, "1", ttlSeconds);
  },

  async isBlacklisted(token: string): Promise<boolean> {
    return this.exists(`blacklist:${token}`);
  },

  // Session helpers
  async setSession(userId: string, data: object, ttlSeconds = 86400): Promise<void> {
    await this.set(`session:${userId}`, JSON.stringify(data), ttlSeconds);
  },

  async getSession(userId: string): Promise<object | null> {
    const raw = await this.get(`session:${userId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  async deleteSession(userId: string): Promise<void> {
    await this.del(`session:${userId}`);
  },
};

export default cache;
