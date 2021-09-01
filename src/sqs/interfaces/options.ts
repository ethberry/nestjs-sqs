import { Type } from "@nestjs/common";
import { ClientProxy, Deserializer, Serializer } from "@nestjs/microservices";
import { ConsumerOptions } from "sqs-consumer";
import { Producer } from "sqs-producer";
import { SQS } from "aws-sdk";

export type ProducerOptions = Parameters<typeof Producer.create>[0] & {
  serializer?: Serializer;
  deserializer?: Deserializer;
};

export interface ISqsClientOptions {
  customClass: Type<ClientProxy>;
  options: ProducerOptions;
}

export type SqsConsumerOptions = Omit<ConsumerOptions, "handleMessage" | "handleMessageBatch"> & {
  serializer?: Serializer;
  deserializer?: Deserializer;
};

export interface ISqsServerOptions {
  customClass: Type<ClientProxy>;
  options: SqsConsumerOptions;
}

export enum TestQueue {
  Test = "test",
  DLQ = "test-dead",
}

export interface IMessage<T = any> {
  id: string;
  body: T;
  groupId?: string;
  deduplicationId?: string;
  delaySeconds?: number;
  messageAttributes?: SQS.MessageBodyAttributeMap;
}
