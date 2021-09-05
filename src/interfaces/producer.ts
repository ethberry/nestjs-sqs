import { Producer } from "sqs-producer";
import { Deserializer, Serializer } from "@nestjs/microservices";

export type ProducerOptions = Omit<Parameters<typeof Producer.create>[0], "queueUrl"> & {
  producerUrl: string;
  consumerUrl: string;
  serializer?: Serializer;
  deserializer?: Deserializer;
};
