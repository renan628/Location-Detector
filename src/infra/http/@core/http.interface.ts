export interface IHttpRequest {
  get(path: string, query?: Object): Promise<any>
}