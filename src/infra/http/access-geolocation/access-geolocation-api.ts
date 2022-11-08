import { IHttpRequest } from "../@core/http.interface";

export class AccessGeolocationAPI implements IHttpRequest {
  private readonly apiKey: string;
  private httpRequester: IHttpRequest;

  constructor(httpRequester: IHttpRequest, apiKey: string) {
    this.httpRequester = httpRequester;
    this.apiKey = apiKey;
  }

  async get(path: string, query?: Object): Promise<any> {
    const params = {
      access_key: this.apiKey,
      ...query
    }
    
    return await this.httpRequester.get(path, params);
  }
}