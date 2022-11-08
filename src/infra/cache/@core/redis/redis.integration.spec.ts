import { RedisCache } from "./redis";
import { sleep } from "../../../../util/util";
import { ICache } from "../cache.interface";

describe("Redis cache unit test", () => {
  let redisCache: ICache;
  const cacheTime: number = parseInt(process.env.REDIS_CACHE_TIME) || 30;

  beforeAll(async () => {
    redisCache = new RedisCache({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    await redisCache.start();
  });

  afterAll(async () => {
    await redisCache.stop();
  });

  it("Should set and get a value in cache", async () => {
    const key = "key1";
    const value = "value1";

    await expect(redisCache.set(key, value, cacheTime)).resolves.toEqual(
      undefined,
    );
    await expect(redisCache.get(key)).resolves.toEqual(value);
  });

  it("Should delete a value in cache", async () => {
    const key = "key2";
    const value = "value2";

    await expect(redisCache.set(key, value, cacheTime)).resolves.toEqual(
      undefined,
    );
    await expect(redisCache.get(key)).resolves.toEqual(value);
    await expect(redisCache.delete(key)).resolves.toEqual(undefined);
    await expect(redisCache.get(key)).resolves.toBeFalsy();
  });

  it("Should set a value and delete it after the TTL", async () => {
    const key = "key3";
    const value = "value3";

    await expect(redisCache.get(key)).resolves.toBeFalsy();
    await expect(redisCache.set(key, value, 1)).resolves.toEqual(undefined);
    await expect(redisCache.get(key)).resolves.toEqual(value);
    await sleep(1);
    await expect(redisCache.get(key)).resolves.toBeFalsy();
  });
});
