export type IEventHandler = (message: any) => void;
export type topic = string;

export interface IConsumer {
  start(): Promise<void>;
  stop(): Promise<void>;
  registerHandlers(handlersMap: Map<topic, IEventHandler>): void;
}
