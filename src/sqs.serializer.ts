import type { ReadPacket, Serializer } from "@nestjs/microservices";
import { v4 } from "uuid";

export class SqsSerializer implements Serializer {
  serialize(value: ReadPacket): any {
    const id = v4();
    return {
      id,
      body: JSON.stringify(value),
      delaySeconds: 0,
      groupId: "nestjs",
      deduplicationId: id,
    };
  }
}
