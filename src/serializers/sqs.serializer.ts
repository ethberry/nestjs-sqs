import { randomUUID } from "node:crypto";

import type { ReadPacket, Serializer } from "@nestjs/microservices";

/** Default serializer for standard SQS queues (no FIFO-only fields). */
export class SqsSerializer implements Serializer {
  serialize(value: ReadPacket): any {
    return {
      id: randomUUID(),
      body: JSON.stringify(value),
      delaySeconds: 0,
    };
  }
}
