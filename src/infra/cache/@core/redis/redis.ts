import { ICache } from "../cache.interface";
import Redis, { RedisOptions } from "ioredis";

export class RedisCache implements ICache {
  private client: Redis;

  constructor(options: RedisOptions) {
    this.client = new Redis(options);
  }

  async start() {
    try {
      await this.client.connect();
    }
    catch (err) {
      throw new Error("Error starting redis", { cause: err });
    }
  }

  async stop() {
    try {
      await this.client.quit();
    }
    catch (err) {
      throw new Error("Error starting redis", { cause: err });
    }
  }

  async set(key: string, value: string, seconds: number = 0): Promise<void>{
    try {
      if (seconds) {
        await this.client.set(key, value, "EX", seconds, "NX");
        return;
      }
      await this.client.set(key, value, "NX");
    }
    catch (err) {
      throw new Error("Error setting redis value", { cause: err });
    }
  }

  async get(key: string): Promise<string> {
    try {
      return await this.client.get(key);
    }
    catch (err) {
      throw new Error("Error getting redis value", { cause: err });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    }
    catch (err) {
      throw new Error("Error deleting redis value", { cause: err });
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      const res = await this.client.ping();
      return res === "PONG";
    }
    catch (err) {
      return false;
    }
  }
}