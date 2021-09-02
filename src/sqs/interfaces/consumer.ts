import { ConsumerOptions } from "sqs-consumer";
import { Deserializer, Serializer } from "@nestjs/microservices";

export type SqsConsumerOptions = Omit<ConsumerOptions, "handleMessage" | "handleMessageBatch"> & {
  serializer?: Serializer;
  deserializer?: Deserializer;
};
