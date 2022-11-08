import { ICache } from "src/infra/cache/@core/cache.interface";
import { IHttpRequest } from "src/infra/http/@core/http.interface";
import { IProducer } from "src/infra/stream/@core/producer.interface";
import {
  InputClientAccessDTO,
  OutputClientAccessDTO,
} from "./getClientAccessData.dto";
import { GetClientAccessDataUseCase } from "./getClientAccessData.usecase";

jest.useFakeTimers();

const MockedData = {
  country_name: "United States",
  region_name: "California",
  city: "Los Angeles",
  latitude: 34.0453,
  longitude: -118.2413,
};

class MockHttpRequest implements IHttpRequest {
  get = jest.fn(async (path: string, query?: Record<string, unknown>) => {
    return MockedData;
  });
}

class MockStreamProducer implements IProducer {
  send = jest.fn(async (topic: string, data: any) => {
    return;
  });
  sendBatch = jest.fn();
  start = jest.fn();
  stop = jest.fn();
}

class MockCache implements ICache {
  private cacheInMemory;
  constructor() {
    this.cacheInMemory = {};
  }

  start = jest.fn(async () => {
    return;
  });
  stop = jest.fn(async () => {
    return;
  });
  set = jest.fn(async (key: string, value: string, seconds: number) => {
    this.cacheInMemory[key] = value;
    setTimeout(() => {
      delete this.cacheInMemory[key];
    }, seconds);
  });
  get = jest.fn(async (key: string) => {
    return this.cacheInMemory[key];
  });
  delete = jest.fn(async (key: string) => {
    delete this.cacheInMemory[key];
  });
}

describe("Get client data use case unit test", () => {
  let input: InputClientAccessDTO;
  let expectedOutput: OutputClientAccessDTO;
  const outputTopic: string = process.env.OUTPUT_TOPIC || "output";

  beforeAll(() => {
    input = {
      clientID: "U1",
      ip: "134.201.250.155",
      timestamp: 0,
    };
    expectedOutput = {
      ...input,
      latitude: 34.0453,
      longitude: -118.2413,
      country: "United States",
      region: "California",
      city: "Los Angeles",
    };
  });

  beforeAll(() => {
    jest.restoreAllMocks();
  });

  it("Should get client data from API and send to stream if value is not in cache", async () => {
    const localMockStreamProducer = new MockStreamProducer();
    const localMockHttpRequest = new MockHttpRequest();
    const localMockCache = new MockCache();
    const localInput = { ...input };
    const cacheKey = `${localInput.clientID}-${localInput.ip}`;
    const getClientAccessDataUseCase = new GetClientAccessDataUseCase(
      localMockStreamProducer,
      localMockHttpRequest,
      localMockCache,
    );

    await expect(
      getClientAccessDataUseCase.execute(localInput),
    ).resolves.toEqual(undefined);

    expect(localMockCache.get).toHaveBeenCalled();
    expect(localMockCache.get).toHaveBeenCalledWith(cacheKey);
    expect(localMockHttpRequest.get).toHaveBeenCalled();
    expect(localMockHttpRequest.get).toHaveBeenCalledWith(`/${localInput.ip}`, {
      fields: ["latitude", "longitude", "country_name", "region_name", "city"],
    });
    expect(localMockCache.set).toHaveBeenCalled();
    expect(localMockCache.set).toHaveBeenCalledWith(
      cacheKey,
      JSON.stringify(expectedOutput),
      30,
    );
    expect(localMockStreamProducer.send).toHaveBeenCalled();
    expect(localMockStreamProducer.send).toHaveBeenCalledWith(outputTopic, {
      value: expectedOutput,
    });

    jest.runOnlyPendingTimers();
    localMockCache.delete(cacheKey);
  });

  it("Should get client data from cache and return if value is in cache", async () => {
    const localMockStreamProducer = new MockStreamProducer();
    const localMockHttpRequest = new MockHttpRequest();
    const localMockCache = new MockCache();
    const localInput = { ...input };
    const cacheKey = `${localInput.clientID}-${localInput.ip}`;
    const getClientAccessDataUseCase = new GetClientAccessDataUseCase(
      localMockStreamProducer,
      localMockHttpRequest,
      localMockCache,
    );

    localMockCache.set(cacheKey, JSON.stringify(expectedOutput), 30);

    await expect(
      getClientAccessDataUseCase.execute(localInput),
    ).resolves.toEqual(undefined);

    expect(localMockCache.get).toHaveBeenCalled();
    expect(localMockCache.get).toHaveBeenCalledWith(cacheKey);
    expect(localMockHttpRequest.get).not.toHaveBeenCalled();
    expect(localMockCache.set).toHaveBeenCalledTimes(1); //Previous call above
    expect(localMockStreamProducer.send).not.toHaveBeenCalled();

    localMockCache.delete(cacheKey);
  });

  it("Should get client data from API and send to stream if cache expired", async () => {
    const localMockStreamProducer = new MockStreamProducer();
    const localMockHttpRequest = new MockHttpRequest();
    const localMockCache = new MockCache();
    const localInput = { ...input };
    const cachedExpectedOutput = { ...expectedOutput };
    const cacheKey = `${localInput.clientID}-${localInput.ip}`;
    const getClientAccessDataUseCase = new GetClientAccessDataUseCase(
      localMockStreamProducer,
      localMockHttpRequest,
      localMockCache,
    );

    localMockCache.set(localInput.ip, JSON.stringify(cachedExpectedOutput), 30);
    jest.runOnlyPendingTimers();

    await expect(
      getClientAccessDataUseCase.execute(localInput),
    ).resolves.toEqual(undefined);

    expect(localMockCache.get).toHaveBeenCalled();
    expect(localMockCache.get).toHaveBeenCalledWith(cacheKey);
    expect(localMockHttpRequest.get).toHaveBeenCalled();
    expect(localMockHttpRequest.get).toHaveBeenCalledWith(`/${localInput.ip}`, {
      fields: ["latitude", "longitude", "country_name", "region_name", "city"],
    });
    expect(localMockCache.set).toHaveBeenCalled();
    expect(localMockCache.set).toHaveBeenCalledWith(
      cacheKey,
      JSON.stringify(cachedExpectedOutput),
      30,
    );
    expect(localMockStreamProducer.send).toHaveBeenCalled();
    expect(localMockStreamProducer.send).toHaveBeenCalledWith(outputTopic, {
      value: cachedExpectedOutput,
    });

    localMockCache.delete(cacheKey);
  });

  it("Should throw an exception if invalid data", async () => {
    const localMockStreamProducer = new MockStreamProducer();
    const localMockHttpRequest = new MockHttpRequest();
    const localMockCache = new MockCache();
    const getClientAccessDataUseCase = new GetClientAccessDataUseCase(
      localMockStreamProducer,
      localMockHttpRequest,
      localMockCache,
    );

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    // eslint-disable-next-line prettier/prettier
    await expect( getClientAccessDataUseCase.execute({ip: 1,clientID: 2,timestamp: "abc",}),
    ).rejects.toThrow("Error executing GetClientDataUseCase");

    expect(localMockHttpRequest.get).not.toHaveBeenCalled();
  });

  it("Should throw an exception if API fails", async () => {
    const localMockStreamProducer = new MockStreamProducer();
    const localMockHttpRequest = new MockHttpRequest();
    const localMockCache = new MockCache();
    const getClientAccessDataUseCase = new GetClientAccessDataUseCase(
      localMockStreamProducer,
      localMockHttpRequest,
      localMockCache,
    );

    const getSpy = jest
      .spyOn(localMockHttpRequest, "get")
      .mockRejectedValue(new Error("Some http error"));

    await expect(getClientAccessDataUseCase.execute(input)).rejects.toThrow(
      "Error executing GetClientDataUseCase",
    );

    expect(getSpy).toHaveBeenCalled();
    expect(getSpy).toHaveBeenCalledWith(`/${input.ip}`, {
      fields: ["latitude", "longitude", "country_name", "region_name", "city"],
    });
  });

  it("Should throw an exception if producer fails", async () => {
    const localMockStreamProducer = new MockStreamProducer();
    const localMockHttpRequest = new MockHttpRequest();
    const localMockCache = new MockCache();
    const getClientAccessDataUseCase = new GetClientAccessDataUseCase(
      localMockStreamProducer,
      localMockHttpRequest,
      localMockCache,
    );

    const sendSpy = jest
      .spyOn(localMockStreamProducer, "send")
      .mockRejectedValue(new Error("Some producer error"));

    await expect(getClientAccessDataUseCase.execute(input)).rejects.toThrow(
      "Error executing GetClientDataUseCase",
    );

    expect(localMockHttpRequest.get).toHaveBeenCalled();
    expect(localMockHttpRequest.get).toHaveBeenCalledWith(`/${input.ip}`, {
      fields: ["latitude", "longitude", "country_name", "region_name", "city"],
    });
    expect(sendSpy).toHaveBeenCalled();
    expect(sendSpy).toHaveBeenCalledWith(outputTopic, {
      value: expectedOutput,
    });
  });
});
