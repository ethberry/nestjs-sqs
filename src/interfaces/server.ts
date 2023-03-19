import { Type } from "@nestjs/common";
import { ClientProxy, Deserializer, Serializer } from "@nestjs/microservices";
import { ConsumerOptions } from "sqs-consumer";
import { ProducerOptions } from "sqs-producer";

export interface ISqsServerOptions {
  customClass: Type<ClientProxy>;
  options: {
    consumerOptions: ConsumerOptions;
    producerOptions: ProducerOptions;
    serializer?: Serializer;
    deserializer?: Deserializer;
  };
}
