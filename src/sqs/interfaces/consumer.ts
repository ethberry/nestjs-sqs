import { ConsumerOptions } from "sqs-consumer";
import { Deserializer, Serializer } from "@nestjs/microservices";

export type SqsConsumerOptions = Omit<ConsumerOptions, "queueUrl" | "handleMessage" | "handleMessageBatch"> & {
  consumerUrl: string;
  producerUrl: string;
  serializer?: Serializer;
  deserializer?: Deserializer;
};
