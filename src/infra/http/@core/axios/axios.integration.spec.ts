import { IHttpRequest } from "../http.interface";
import { AxiosHttpRequest } from "./axios";
import nock from "nock";

describe("Node HTTPS unit test", () => {
  const fakeApiURL: string = "http://someurl"
  let axiosRequest: IHttpRequest;

  beforeAll(() => {
    axiosRequest = new AxiosHttpRequest(fakeApiURL);
  })

  it("Should make a get request for a json api", async () => {
    const fakePath: string = "/somepath";
    const fakeResponse = { result: "OK" };
    const queryParams = {
      param1: "value1",
      param2: "value2",
    }

    nock(fakeApiURL)
    .get(fakePath)
    .query(queryParams)
    .reply(200, fakeResponse)

    await expect(axiosRequest.get(fakePath, queryParams)).resolves.toEqual(fakeResponse);
  })
})