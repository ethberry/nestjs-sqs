import { Type } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { SqsConsumerOptions } from "./consumer";

export interface ISqsServerOptions {
  customClass: Type<ClientProxy>;
  options: SqsConsumerOptions;
}
