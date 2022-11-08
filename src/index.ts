import { KafkaConsumer } from "./infra/stream/@core/kafka/consumer";
import { KafkaProducer } from "./infra/stream/@core/kafka/producer";
import {
  IConsumer,
  IEventHandler,
  topic,
} from "./infra/stream/@core/consumer.interface";
import { IProducer } from "./infra/stream/@core/producer.interface";
import { AxiosHttpRequest } from "./infra/http/@core/axios/axios";
import { ICache } from "./infra/cache/@core/cache.interface";
import { RedisCache } from "./infra/cache/@core/redis/redis";
import { GetClientAccessDataUseCase } from "./application/clientAccess/getClientAccessData/getClientAccessData.usecase";
import dotenv from "dotenv";
import { IHttpRequest } from "./infra/http/@core/http.interface";
import { AccessGeolocationAPI } from "./infra/http/access-geolocation/access-geolocation-api";
import { Kafka, logLevel, Partitioners } from "kafkajs";

const ENV = process.env.NODE_ENV;
const ENV_PATH = ENV ? `.${ENV}` : "";
dotenv.config({ path: `.env${ENV_PATH}` });

const cache: ICache = new RedisCache({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: 5,
  lazyConnect: true,
});

const kafka: Kafka = new Kafka({
  brokers: process.env.KAFKA_BROKERS?.split(";") || ["localhost:9094"],
  clientId: process.env.KAFKA_CLIENT_ID || "client",
  logLevel: parseInt(process.env.KAFKA_LOG_LEVEL) || logLevel.INFO,
});

const requester: IHttpRequest = new AxiosHttpRequest(
  process.env.API_URL || "http://api.ipstack.com",
);

const apiGeolocationRequester: IHttpRequest = new AccessGeolocationAPI(
  requester,
  process.env.API_KEY,
);

const producer: IProducer = new KafkaProducer(kafka, {
  createPartitioner: Partitioners.DefaultPartitioner,
  ack: parseInt(process.env.KAFKA_ACK) || -1,
});

const consumer: IConsumer = new KafkaConsumer(kafka, {
  groupId: process.env.KAFKA_CONSUMER_GROUP || "consumer-group",
});

export const main = async (
  cache: ICache,
  producer: IProducer,
  consumer: IConsumer,
  apiGeolocationRequester: IHttpRequest,
) => {
  const INPUT_TOPIC = process.env.INPUT_TOPIC || "input";
  try {
    await cache.start();
    await producer.start();

    consumer.registerHandlers(
      new Map<topic, IEventHandler>([
        [
          INPUT_TOPIC,
          async (message) => {
            await new GetClientAccessDataUseCase(
              producer,
              apiGeolocationRequester,
              cache,
            ).execute(message);
          },
        ],
      ]),
    );
    await consumer.start();

    console.log("App initiallized");
    return;
  } catch (err) {
    console.error(err);
  }
};

main(cache, producer, consumer, apiGeolocationRequester);
