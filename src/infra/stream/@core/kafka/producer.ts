import { Kafka, KafkaConfig, logCreator, logLevel, Message, Partitioners, Producer, ProducerBatch, ProducerConfig, ProducerRecord, TopicMessages } from "kafkajs"
import { IProducer } from "../producer.interface";

export type KafkaProducerConfig = ProducerConfig & {
  ack: number;
};

export class KafkaProducer implements IProducer {
  private kafka: Kafka;
  private producer: Producer;
  private ack: number;

  constructor(kafka: Kafka, options: KafkaProducerConfig) {
    const { ack } = options;
    this.ack = ack;
    this.kafka = kafka;
    this.producer = this.kafka.producer(options);
  }

  public async start(): Promise<void> {
    try {
      await this.producer.connect();
    } 
    catch (err) {
      throw new Error("Error starting kafka producer", { cause: err })
    }
  }

  public async stop(): Promise<void> {
    try {
      await this.producer.disconnect();
    }
    catch (err) {
      throw new Error("Error stopping kafka producer", { cause: err });
    }
  }

  public async send(topic: string, message: { key?: string, value: any }): Promise<void> {
    const { key, value } = message;
    const messageF: Message = {
      value: JSON.stringify(value)
    }
    if (key) {
      messageF.key = key
    }

    const topicMessages: ProducerRecord = {
      acks: this.ack,
      topic,
      messages: [messageF],
    }

    try {
      await this.producer.send(topicMessages)
    }
    catch (err) {
      throw new Error("Error sending kafka message", { cause: err });
    }
  }

  public async sendBatch(topic: string, messages: Array<{ key?: string, value: any }>): Promise<void> {
    const messageF : Array<Message> = messages.map((message) => {
      const { key, value } = message;
      const payload: Message = {
        value: JSON.stringify(value)
      }
      if (key) {
        payload.key = key
      }

      return payload;
    })

    const topicMessages: ProducerRecord = {
      acks: this.ack,
      topic,
      messages: messageF,
    }

    try {
      await this.producer.send(topicMessages)
    }
    catch (err) {
      throw new Error("Error sending kafka message batch", { cause: err });
    }
  }
}