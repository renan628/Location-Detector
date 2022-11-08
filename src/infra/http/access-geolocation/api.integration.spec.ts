import { IHttpRequest } from "../@core/http.interface";
import { AxiosHttpRequest } from "../@core/axios/axios";
import { AccessGeolocationAPI } from "./access-geolocation-api";
import nock from "nock";
import qs from "qs";

describe("Node HTTPS unit test", () => {
  const fakeApiURL = "http://someapi/api";
  const fakeAccessKey = "FAKEKEY";
  let axiosRequester: IHttpRequest;
  let accessGeolocationAPI: IHttpRequest;

  beforeAll(() => {
    axiosRequester = new AxiosHttpRequest(fakeApiURL);
    accessGeolocationAPI = new AccessGeolocationAPI(
      axiosRequester,
      fakeAccessKey,
    );
  });

  it('Should make a get request for a json api with first parameter as "access_key"', async () => {
    const fakePath = "/somepath";
    const fakeResponse = { result: "OK" };
    const queryParams = {
      param1: "value1",
      param2: "value2",
      param3: qs.stringify(["p1, p2, p3"], { arrayFormat: "comma" }),
    };

    nock(fakeApiURL)
      .get(fakePath)
      .query({ access_key: fakeAccessKey, ...queryParams })
      .reply(200, fakeResponse);

    await expect(
      accessGeolocationAPI.get(fakePath, queryParams),
    ).resolves.toEqual(fakeResponse);
  });
});
