import { IHttpRequest } from "../http.interface";
import axios, { AxiosRequestConfig } from "axios";
import qs from "qs";

export class AxiosHttpRequest implements IHttpRequest {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async get(path: string, query: Record<string, unknown> = null): Promise<any> {
    try {
      const res = await this.request(path, "GET", query);

      return res.data;
    } catch (err) {
      const error = err.AxiosError ?? err;
      let message = "Error sending http request";
      if (error.response) {
        message =
          message +
          `\nStatus code ${error.response.status} - ${error.response.statusText}`;
        if (error.response.data) {
          const data =
            typeof error.response.data === "object"
              ? JSON.stringify(error.response.data)
              : error.response.data;
          message = message + `\nMessage ${data}`;
        }
      } else if (error.message) {
        message = message + `\nMessage ${error.message}`;
      }
      throw new Error(message, { cause: error });
    }
  }

  private async request(
    path: string,
    method: string,
    queryParam: Record<string, unknown>,
    body: any = null,
  ): Promise<any> {
    const config: AxiosRequestConfig = {
      baseURL: this.baseURL,
      url: path,
      method: method,
      data: body,
      params: queryParam,
      paramsSerializer: {
        serialize: (params) => qs.stringify(params, { arrayFormat: "comma" }),
      },
    };

    return await axios.request(config);
  }
}
