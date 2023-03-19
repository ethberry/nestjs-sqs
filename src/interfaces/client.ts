import { Type } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";

import { ProducerOptions } from "./producer";

export interface ISqsClientOptions {
  customClass: Type<ClientProxy>;
  options: ProducerOptions;
}
