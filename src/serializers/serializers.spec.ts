import type { ReadPacket } from "@nestjs/microservices";

import { SqsFifoSerializer } from "./sqs-fifo.serializer";
import { SqsSimpleSerializer } from "./sqs-simple.serializer";

describe("SqsSimpleSerializer", () => {
  const packet = { pattern: "EVENT", data: { n: 1 } } as unknown as ReadPacket;

  it("serializes without FIFO-only fields", () => {
    const serializer = new SqsSimpleSerializer();
    const message = serializer.serialize(packet);

    expect(message).toMatchObject({
      id: expect.any(String),
      body: JSON.stringify(packet),
      delaySeconds: 0,
    });
    expect(message).not.toHaveProperty("groupId");
    expect(message).not.toHaveProperty("deduplicationId");
  });
});

describe("SqsFifoSerializer", () => {
  const packet = { pattern: "EVENT", data: { n: 1 } } as unknown as ReadPacket;

  it("serializes with groupId and deduplicationId", () => {
    const serializer = new SqsFifoSerializer();
    const message = serializer.serialize(packet) as { id: string; deduplicationId: string };

    expect(message).toMatchObject({
      id: expect.any(String),
      body: JSON.stringify(packet),
      delaySeconds: 0,
      groupId: "nestjs",
      deduplicationId: message.id,
    });
  });
});
