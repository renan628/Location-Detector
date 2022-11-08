import { IConsumer, IEventHandler } from "../consumer.interface";
import { IProducer } from "../producer.interface";
import { KafkaConsumer, waitForKafkaMessages } from "./consumer";
import { KafkaProducer } from "./producer";
import { Admin, Kafka, logLevel, Partitioners } from "kafkajs";

const oneMessageTopic = "test-one-message";
const batchMessageTopic = "test-batch-message";

const messages = [
  {
    key: "key1",
    value: {
      attribute: "attributeValue1",
    },
  },
  {
    key: "key2",
    value: {
      attribute: "attributeValue2",
    },
  },
  {
    key: "key3",
    value: {
      attribute: "attributeValue3",
    },
  },
];

describe("Kafka stream unit test", () => {
  let kafka: Kafka;
  let kafkaConsumer: IConsumer;
  let kafkaProducer: IProducer;
  let kafkaAdmin: Admin;

  beforeAll(async () => {
    kafka = new Kafka({
      brokers: process.env.KAFKA_BROKERS?.split(";") || ["localhost:9094"],
      clientId: process.env.KAFKA_CLIENT_ID || "client",
      logLevel: parseInt(process.env.KAFKA_LOG_LEVEL) || logLevel.INFO,
    });
    kafkaConsumer = new KafkaConsumer(kafka, {
      groupId: Date.now() + "_" + "kafkaTest",
    });
    kafkaProducer = new KafkaProducer(kafka, {
      createPartitioner: Partitioners.DefaultPartitioner,
      ack: 1,
    });
    kafkaAdmin = kafka.admin();
    await kafkaAdmin.connect();
  });

  afterAll(async () => {
    await kafkaAdmin.disconnect();
    await kafkaConsumer.stop();
    await kafkaProducer.stop();
  });

  it("Should send one message to a topic", async () => {
    const topicName: string = Date.now() + "_" + oneMessageTopic;
    const groupId: string = Date.now() + "_" + "kafkaTest";

    await kafkaAdmin.createTopics({
      waitForLeaders: true,
      topics: [{ topic: topicName }],
    });

    const message = messages[0];
    await kafkaProducer.start();
    await kafkaProducer.send(topicName, message);

    const receivedMessages = await waitForKafkaMessages(
      kafka,
      1,
      topicName,
      true,
      groupId,
    );
    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0]).toEqual(messages[0]);

    await kafkaProducer.stop();
    await kafkaAdmin.deleteTopics({
      topics: [topicName],
    });
  }, 10000);

  it("Should send a batch of messages to a topic", async () => {
    const topicName: string = Date.now() + "_" + batchMessageTopic;
    const groupId: string = Date.now() + "_" + "kafkaTest";

    await kafkaAdmin.createTopics({
      waitForLeaders: true,
      topics: [{ topic: topicName }],
    });

    await kafkaProducer.start();
    await kafkaProducer.sendBatch(topicName, messages);

    const receivedMessages = await waitForKafkaMessages(
      kafka,
      3,
      topicName,
      true,
      groupId,
    );
    expect(receivedMessages).toHaveLength(messages.length);
    expect(receivedMessages[0]).toEqual(messages[0]);
    expect(receivedMessages[1]).toEqual(messages[1]);
    expect(receivedMessages[2]).toEqual(messages[2]);

    await kafkaProducer.stop();
    await kafkaAdmin.deleteTopics({
      topics: [topicName],
    });
  }, 10000);

  it("Should consume messages from a topic and call the registered handler", async () => {
    let resolveOnConsumption: (messages: any) => void;
    let rejectOnError: (e: Error) => void;
    const consumingPromise = new Promise<void>((resolve, reject) => {
      resolveOnConsumption = resolve;
      rejectOnError = reject;
    });

    const topicName: string = Date.now() + "_" + oneMessageTopic;
    await kafkaAdmin.createTopics({
      waitForLeaders: true,
      topics: [{ topic: topicName }],
    });

    const receivedMessages = [];
    let numCalls = 0;
    const proccessMessage = async (message) => {
      numCalls++;
      receivedMessages.push(message);
      if (receivedMessages.length === messages.length) {
        resolveOnConsumption(receivedMessages);
      }
    };

    const messageHandler = new Map<string, IEventHandler>([
      [topicName, proccessMessage],
    ]);

    await kafkaProducer.start();
    await kafkaProducer.sendBatch(topicName, messages);

    await kafkaConsumer.registerHandlers(messageHandler);
    await kafkaConsumer.start();

    const resolvedMessages = await consumingPromise;
    expect(numCalls).toEqual(3);
    expect(resolvedMessages).toHaveLength(messages.length);
    expect(resolvedMessages[0]).toEqual(messages[0].value);
    expect(resolvedMessages[1]).toEqual(messages[1].value);
    expect(resolvedMessages[2]).toEqual(messages[2].value);

    await kafkaProducer.stop();
    await kafkaConsumer.stop();
    await kafkaAdmin.deleteTopics({
      topics: [topicName],
    });
  }, 10000);
});
