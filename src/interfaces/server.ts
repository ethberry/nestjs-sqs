import type { Type } from "@nestjs/common";
import type { ClientProxy, Deserializer, Serializer } from "@nestjs/microservices";
import type { ConsumerOptions } from "sqs-consumer";
import type { ProducerOptions } from "sqs-producer";

export interface ISqsServerOptions {
  customClass: Type<ClientProxy>;
  options: {
    consumerOptions: ConsumerOptions;
    producerOptions: ProducerOptions;
    serializer?: Serializer;
    deserializer?: Deserializer;
  };
}
