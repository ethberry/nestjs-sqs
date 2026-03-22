import { randomUUID } from "node:crypto";

import type { ReadPacket, Serializer } from "@nestjs/microservices";

/** Serializer for FIFO queues (`MessageGroupId` / `MessageDeduplicationId` required by SQS). */
export class SqsFifoSerializer implements Serializer {
  serialize(value: ReadPacket): any {
    const id = randomUUID();
    return {
      id,
      body: JSON.stringify(value),
      delaySeconds: 0,
      groupId: "nestjs",
      deduplicationId: id,
    };
  }
}
