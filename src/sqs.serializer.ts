import { Serializer } from "@nestjs/microservices";
import { v4 } from "uuid";

export class SqsSerializer implements Serializer {
  serialize(value: any): any {
    const id = v4();
    return {
      id,
      body: JSON.stringify(value),
      delaySeconds: 0,
      groupId: "test",
      deduplicationId: id,
    };
  }
}
