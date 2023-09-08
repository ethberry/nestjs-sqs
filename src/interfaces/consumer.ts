import type { ConsumerOptions } from "sqs-consumer";
import type { Deserializer, Serializer } from "@nestjs/microservices";

export type SqsConsumerOptions = Omit<ConsumerOptions, "queueUrl" | "handleMessage" | "handleMessageBatch"> & {
  consumerUrl: string;
  producerUrl: string;
  serializer?: Serializer;
  deserializer?: Deserializer;
};
