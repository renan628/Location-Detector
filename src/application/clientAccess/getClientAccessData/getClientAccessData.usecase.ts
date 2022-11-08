import { ICache } from "src/infra/cache/@core/cache.interface";
import { IHttpRequest } from "src/infra/http/@core/http.interface";
import { IProducer } from "src/infra/stream/@core/producer.interface";
import {
  InputClientAccessDTO,
  validadeInputClientAccessDTO,
} from "./getClientAccessData.dto";

const OUTPUT_TOPIC = process.env.OUTPUT_TOPIC || "output";

export class GetClientAccessDataUseCase {
  private producer: IProducer;
  private httpApi: IHttpRequest;
  private cache: ICache;
  private cacheTime: number;

  constructor(producer: IProducer, httpApi: IHttpRequest, cache: ICache) {
    this.producer = producer;
    this.httpApi = httpApi;
    this.cache = cache;
    this.execute = this.execute.bind(this);
    this.cacheTime = parseInt(process.env.REDIS_CACHE_TIME) || 30 * 60;
  }

  async execute(input: InputClientAccessDTO): Promise<void> {
    try {
      validadeInputClientAccessDTO(input);

      const { clientID, ip } = input;
      const cacheKey = `${clientID}-${ip}`;
      console.log("Received new client-ip", cacheKey);
      const cachedValue = await this.cache.get(cacheKey);
      console.log(cachedValue);
      if (cachedValue) {
        console.log("Returning from cache", cacheKey);
        return;
      }
      await this.cache.set(cacheKey, cacheKey, this.cacheTime);

      const { latitude, longitude, country_name, region_name, city } =
        await this.httpApi.get(`/${ip}`, {
          fields: [
            "latitude",
            "longitude",
            "country_name",
            "region_name",
            "city",
          ],
        });

      const output = {
        ...input,
        latitude,
        longitude,
        country: country_name,
        region: region_name,
        city,
      };
      await this.cache.set(cacheKey, JSON.stringify(output), this.cacheTime);
      await this.producer.send(OUTPUT_TOPIC, {
        value: output,
      });
      console.log("Data fetched and sent to server", cacheKey);
    } catch (err) {
      console.error(err);
      throw new Error("Error executing GetClientDataUseCase", { cause: err });
    }
  }
}
