export interface IProducer {
  start(): Promise<void>;
  stop(): Promise<void>;
  sendBatch(topic:string, messages: Array<{ key?: string, value: any }>): Promise<void>;
  send(topic: string, message: { key?: string, value: any }): Promise<void>;
}