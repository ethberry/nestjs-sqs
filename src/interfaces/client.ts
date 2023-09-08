import type { Type } from "@nestjs/common";
import type { ClientProxy } from "@nestjs/microservices";

import type { ProducerOptions } from "./producer";

export interface ISqsClientOptions {
  customClass: Type<ClientProxy>;
  options: ProducerOptions;
}
