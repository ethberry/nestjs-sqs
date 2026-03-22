import type { Deserializer } from "@nestjs/microservices";
import type { Message } from "@aws-sdk/client-sqs";

import type { SqsClientInboundPacket, SqsServerInboundPacket } from "../types/sqs-packets";
import { assertSqsMessageBody } from "../types/sqs-packets";

export class SqsDeserializer<
  TWire extends SqsServerInboundPacket | SqsClientInboundPacket = SqsServerInboundPacket,
> implements Deserializer<Message, TWire> {
  deserialize(value: Message): TWire {
    assertSqsMessageBody(value.Body);
    let body: unknown;
    try {
      body = JSON.parse(value.Body);
    } catch {
      throw new Error("SQS message Body is not valid JSON");
    }
    if (typeof body !== "object" || body === null) {
      throw new Error("SQS message Body must be a JSON object");
    }
    const o = body as Record<string, unknown>;

    if ("pattern" in o) {
      if (!("data" in o)) {
        throw new Error("SQS message Body has `pattern` but is missing `data`");
      }
      return o as TWire;
    }
    if (typeof o.id === "string") {
      return o as TWire;
    }
    throw new Error("SQS message Body is not a valid Nest microservice packet (expected pattern+data or reply id)");
  }
}
