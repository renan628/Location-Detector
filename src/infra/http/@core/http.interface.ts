export interface IHttpRequest {
  get(path: string, query?: Record<string, unknown>): Promise<any>;
}
