import type { Deserializer } from "@nestjs/microservices";

/** Parses `Message.Body` JSON. Same for standard and FIFO queues (FIFO metadata is not in `Body`). */
export class SqsDeserializer implements Deserializer {
  deserialize(value: any): any {
    return JSON.parse(value.Body);
  }
}
