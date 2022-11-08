import { Consumer, ConsumerSubscribeTopics, logLevel, EachBatchPayload, Kafka, EachMessagePayload, Message, KafkaConfig, ConsumerConfig } from "kafkajs"
import { EventEmitter } from "events"
import { IConsumer, IEventHandler, topic } from "../consumer.interface"

export type KafkaConsumerConfig = ConsumerConfig;

export class KafkaConsumer extends EventEmitter implements IConsumer {
  private kafka: Kafka;
  private kafkaConsumer: Consumer
  private topics: Array<string> = [];

  public constructor(kafka: Kafka, options: KafkaConsumerConfig) {
    super();
    this.kafka = kafka;
    this.kafkaConsumer = kafka.consumer(options);
  }

  public async start(): Promise<void> {
    const topic: ConsumerSubscribeTopics = {
      topics: this.topics,
      fromBeginning: true
    }

    try {
      await this.kafkaConsumer.connect();
      await this.kafkaConsumer.subscribe(topic);

      await this.kafkaConsumer.run({
        eachMessage: async (messagePayload: EachMessagePayload) => {
          const { topic, partition, message } = messagePayload
          const prefix = `MESSAGE/${topic}[${partition} | ${message.offset}] / ${message.timestamp}`
          console.log(`- ${prefix} ${message.key}#${message.value}`)
          this.emit(topic, message)
        },
      })
    }
    catch (err) {
      throw new Error("Error starting kafka consumer", { cause: err })
    }
  }

  public async stop(): Promise<void> {
    try {
      await this.kafkaConsumer.disconnect()
    }
    catch (err) {
      throw new Error("Error stopping kafka consumer", { cause: err });
    }
  }

  public registerHandlers(handlersMap: Map<topic, IEventHandler>): void {
    handlersMap.forEach((handler, topic) => {
      this.topics.push(topic);
      this.addListener(topic, async (message) => {
        try {
          await handler(JSON.parse(message.value.toString()));
        }
        catch (err) {
          console.error(`Error executing ${topic} handler`, err)
        }
      });
    })
  }
}

export const waitForKafkaMessages = async (
  kafka: Kafka,
  messagesAmount: number,
  topic: string,
  fromBeginning: boolean,
  groupId: string,
): Promise<Message[]> => {
  const consumer: Consumer = kafka.consumer({ groupId })
  await consumer.connect()
  await consumer.subscribe({ topic, fromBeginning })

  let resolveOnConsumption: (messages: Message[]) => void
  let rejectOnError: (e: Error) => void

  const returnThisPromise = new Promise<Message[]>((resolve, reject) => {
    resolveOnConsumption = resolve
    rejectOnError = reject
  }).finally(() => consumer.disconnect()) // disconnection is done here, reason why is explained below

  const payloads: EachMessagePayload[] = []
  await consumer.run({
    autoCommit: false,
    eachMessage: async (eachMessagePayload: EachMessagePayload) => {
      try {
        const { topic, partition, message } = eachMessagePayload;
        // eachMessage is called by eachBatch which can consume more than messagesAmount.
        // This is why we manually commit only messagesAmount messages.
        if (payloads.length < messagesAmount) {
          payloads.push(eachMessagePayload)

          // +1 because we need to commit the next assigned offset.
          await consumer.commitOffsets([{ topic, partition, offset: (Number(message.offset) + 1).toString() }])
        }

        if (payloads.length === messagesAmount) {
          // I think we should be able to close the connection here, but kafkajs has a bug which makes it hang if consumer.disconnect is called too soon after consumer.run .
          // This is why we close it in the promise"s finally block
          const formatedMesages = payloads.map(payload => {
            return {
              key: payload.message.key.toString(),
              value: JSON.parse(payload.message.value.toString())
            }
          })

          resolveOnConsumption(formatedMesages)
        }
      } catch (e) {
        rejectOnError(e)
      }
    },
  })

  return returnThisPromise
}