export interface ICache {
  start(): Promise<void>;
  stop(): Promise<void>;
  set(key: string, value: string, seconds: number): Promise<void>;
  get(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}
