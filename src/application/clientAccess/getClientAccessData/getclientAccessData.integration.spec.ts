import { Admin, Kafka, logLevel, Partitioners } from "kafkajs";
import nock from "nock";
import qs from "qs";
import { sleep } from "../../../util/util";
import { ICache } from "../../../infra/cache/@core/cache.interface";
import { RedisCache } from "../../../infra/cache/@core/redis/redis";
import { AxiosHttpRequest } from "../../../infra/http/@core/axios/axios";
import { IHttpRequest } from "../../../infra/http/@core/http.interface";
import { AccessGeolocationAPI } from "../../../infra/http/access-geolocation/access-geolocation-api";
import { KafkaProducer } from "../../../infra/stream/@core/kafka/producer";
import { IProducer } from "../../../infra/stream/@core/producer.interface";
import { InputClientAccessDTO, OutputClientAccessDTO } from "./getClientAccessData.dto";
import { GetClientAccessDataUseCase } from "./getClientAccessData.usecase";


const MockedData = {
  "country_name": "United States",
  "region_name": "California",
  "city": "Los Angeles",
  "latitude": 34.0453,
  "longitude": -118.2413,
}

describe("Get client data use case unit test", () => {
  let kafka: Kafka;
  let kafkaAdmin: Admin;
  let apiRequester: IHttpRequest;
  let cache: ICache;
  let producer: IProducer;

  const apiURL: string = process.env.API_URL || "http://api.ipstack.com";
  const apiKey: string = process.env.API_KEY;
  const outputTopic: string = process.env.OUTPUT_TOPIC || "output";
  const cacheTime = parseInt(process.env.REDIS_CACHE_TIME);

  beforeAll(async () => {
    //Kafka set up
    kafka = new Kafka({
      brokers: process.env.KAFKA_BROKERS?.split(";") || ["localhost:9094"],
      clientId: process.env.KAFKA_CLIENT_ID || "client",
      logLevel: parseInt(process.env.KAFKA_LOG_LEVEL) || logLevel.INFO
    })
    producer = new KafkaProducer(kafka, {
      createPartitioner: Partitioners.DefaultPartitioner,
      ack: 1,
    });
    kafkaAdmin = kafka.admin();
    await kafkaAdmin.connect();
    await producer.start();

    //Axios/api set up
    apiRequester = new AccessGeolocationAPI(
      new AxiosHttpRequest(apiURL),
      apiKey
    );

    //Redis set up
    cache = new RedisCache({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: 5,
      lazyConnect: true
    });
    await cache.start();
  }, 10000);

  it("Should get client data from API and send to stream if value is not in cache", async () => {
    const input: InputClientAccessDTO = {
      clientID: "I1",
      ip: "134.201.250.155",
      timestamp: 0,
    }
    const expectedOutput: OutputClientAccessDTO = {
      ...input,
      latitude: MockedData.latitude,
      longitude: MockedData.longitude,
      country: MockedData.country_name,
      region: MockedData.region_name,
      city: MockedData.city,
    }
    const cacheKey: string = `${input.clientID}-${input.ip}`
    
    const getClientAccessDataUseCase = new GetClientAccessDataUseCase(producer, apiRequester, cache);

    const nockPath = `/${input.ip}?${qs.stringify({
      access_key: apiKey,
      fields:
        [
        "latitude",
        "longitude",
        "country_name",
        "region_name",
        "city"
      ]
    }, { arrayFormat: "comma" })}`;

    nock(apiURL)
    .get(nockPath)
    .reply(200, MockedData)

    const cacheGetSpy = jest.spyOn(cache, "get");
    const apiRequesterGetSpy = jest.spyOn(apiRequester, "get");
    const cacheSetSpy = jest.spyOn(cache, "set");
    const producerSendSpy = jest.spyOn(producer, "send");

    await expect(getClientAccessDataUseCase.execute(input)).resolves.toEqual(undefined);

    expect(cacheGetSpy).toHaveBeenCalledWith(cacheKey);
    expect(apiRequesterGetSpy).toHaveBeenCalledWith(`/${input.ip}`, {
      fields: [
        "latitude",
        "longitude",
        "country_name",
        "region_name",
        "city"
      ]
    });
    expect(cacheSetSpy).toHaveBeenCalledWith(cacheKey, JSON.stringify(expectedOutput), cacheTime);
    expect(producerSendSpy).toHaveBeenCalledWith(outputTopic, { value: expectedOutput });
    cache.delete(cacheKey);
  });

  it("Should get client data from cache and return if value is in cache", async () => {
    const input: InputClientAccessDTO = {
      clientID: "I2",
      ip: "134.201.250.154",
      timestamp: 0,
    }
    const expectedOutput: OutputClientAccessDTO = {
      ...input,
      latitude: MockedData.latitude,
      longitude: MockedData.longitude,
      country: MockedData.country_name,
      region: MockedData.region_name,
      city: MockedData.city,
    }
    const getClientAccessDataUseCase = new GetClientAccessDataUseCase(producer, apiRequester, cache);
    
    const cacheKey: string = `${input.clientID}-${input.ip}`
    cache.set(cacheKey, JSON.stringify({ ...expectedOutput, cache: true }), cacheTime);

    const cacheGetSpy = jest.spyOn(cache, "get");
    const apiRequesterGetSpy = jest.spyOn(apiRequester, "get");
    const cacheSetSpy = jest.spyOn(cache, "set");
    const producerSendSpy = jest.spyOn(producer, "send");

    await expect(getClientAccessDataUseCase.execute(input)).resolves.toEqual(undefined);
    expect(cacheGetSpy).toHaveBeenCalledWith(cacheKey);
    expect(apiRequesterGetSpy).not.toHaveBeenCalledWith(`/${input.ip}`, {
      fields: [
        "latitude",
        "longitude",
        "country_name",
        "region_name",
        "city"
      ]
    });
    expect(cacheSetSpy).not.toHaveBeenCalledWith(cacheKey, JSON.stringify(expectedOutput), 30);
    expect(producerSendSpy).not.toHaveBeenCalledWith(outputTopic, { value: expectedOutput });
    cache.delete(cacheKey);
  });

  it("Should get client data from API and send to stream if cache expired", async () => {
    const input: InputClientAccessDTO = {
      clientID: "I3",
      ip: "134.201.250.153",
      timestamp: 0,
    }
    const expectedOutput: OutputClientAccessDTO = {
      ...input,
      latitude: MockedData.latitude,
      longitude: MockedData.longitude,
      country: MockedData.country_name,
      region: MockedData.region_name,
      city: MockedData.city,
    }

    const getClientAccessDataUseCase = new GetClientAccessDataUseCase(producer, apiRequester, cache);

    const nockPath = `/${input.ip}?${qs.stringify({
      access_key: apiKey,
      fields:
        [
        "latitude",
        "longitude",
        "country_name",
        "region_name",
        "city"
      ]
    }, { arrayFormat: "comma" })}`;

    nock(apiURL)
    .get(nockPath)
    .reply(200, MockedData)

    const cacheKey: string = `${input.clientID}-${input.ip}`
    cache.set(cacheKey, JSON.stringify({ ...expectedOutput, cache: true }), 1);
    await sleep(1);

    const cacheGetSpy = jest.spyOn(cache, "get");
    const apiRequesterGetSpy = jest.spyOn(apiRequester, "get");
    const cacheSetSpy = jest.spyOn(cache, "set");
    const producerSendSpy = jest.spyOn(producer, "send");

    await expect(getClientAccessDataUseCase.execute(input)).resolves.toEqual(undefined);

    expect(cacheGetSpy).toHaveBeenCalledWith(cacheKey);
    expect(apiRequesterGetSpy).toHaveBeenCalledWith(`/${input.ip}`, {
      fields: [
        "latitude", 
        "longitude", 
        "country_name", 
        "region_name", 
        "city"
      ]
    });
    expect(cacheSetSpy).toHaveBeenCalledWith(cacheKey, JSON.stringify(expectedOutput), cacheTime);
    expect(producerSendSpy).toHaveBeenCalledWith(outputTopic, { value: expectedOutput });
    cache.delete(cacheKey);
  });
})