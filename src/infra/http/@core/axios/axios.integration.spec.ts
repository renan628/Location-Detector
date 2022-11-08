import { IHttpRequest } from "../http.interface";
import { AxiosHttpRequest } from "./axios";
import nock from "nock";
import { AxiosError } from "axios";

describe("Node HTTPS unit test", () => {
  const fakeApiURL = "http://someurl";
  let axiosRequest: IHttpRequest;

  beforeAll(() => {
    axiosRequest = new AxiosHttpRequest(fakeApiURL);
  });

  it("Should make a get request for a json api", async () => {
    const fakePath = "/somepath";
    const fakeResponse = { result: "OK" };
    const queryParams = {
      param1: "value1",
      param2: "value2",
    };

    nock(fakeApiURL).get(fakePath).query(queryParams).reply(200, fakeResponse);

    await expect(axiosRequest.get(fakePath, queryParams)).resolves.toEqual(
      fakeResponse,
    );
  });

  it("Should throw an exception when receives error status code", async () => {
    const fakePath = "/somepath";
    const fakeResponse = { result: "OK" };
    const queryParams = {
      param1: "value1",
      param2: "value2",
    };

    nock(fakeApiURL).get(fakePath).query(queryParams).reply(500, fakeResponse);

    await expect(axiosRequest.get(fakePath, queryParams)).rejects.toMatchObject(
      {
        message: expect.stringContaining("500"),
        cause: expect.any(AxiosError),
      },
    );
  });
});
