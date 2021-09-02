import { Producer } from "sqs-producer";
import { Deserializer, Serializer } from "@nestjs/microservices";

export type ProducerOptions = Parameters<typeof Producer.create>[0] & {
  serializer?: Serializer;
  deserializer?: Deserializer;
};
