import { IHttpRequest } from "../http.interface";
import axios, { AxiosRequestConfig } from "axios";
import qs from "qs";

const mockResponse = {
  "country_name": "United States",
  "region_name": "California",
  "city": "Los Angeles",
  "latitude": 34.0453,
  "longitude": -118.2413,
}

export class AxiosHttpRequest implements IHttpRequest {
  private baseURL: string;

  constructor(baseURL: string){
    this.baseURL = baseURL;
  }

  async get(path: string, query: Object = null): Promise<any> {
    try {
      const res = await this.request(path, "GET", query);

      //return mockResponse
      return res.data;
    }
    catch (err) {
      const error = err.AxiosError ?? err;
      let message = "Error sending http request";
      if (error.response) {
        message = message + `\nStatus code ${error.response.status} - ${error.response.statusText}`;
        if (error.response.data) {
          const data = typeof error.response.data === "object" ? JSON.stringify(error.response.data) : error.response.data;
          message = message + `\nMessage ${data}`;
        }
      }
      else if (error.message) {
        message = message + `\nMessage ${error.message}`;
      }
      throw new Error(message, { cause: error });
    }
  }

  private async request (path: string, method: string, queryParam: Object, body: any = null): Promise<any> {
    const config: AxiosRequestConfig = {
      baseURL: this.baseURL,
      url: path,
      method: method,
      data: body,
      params: queryParam,
      paramsSerializer: {
        serialize: (params) => qs.stringify(params, { arrayFormat: "comma" })
      }
    };
    
    return await axios.request(config);
  }
}