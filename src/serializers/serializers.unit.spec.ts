import type { ReadPacket } from "@nestjs/microservices";

import { SqsFifoSerializer } from "./sqs-fifo.serializer.js";
import { SqsSerializer } from "./sqs.serializer.js";

describe("SqsSerializer", () => {
  const packet: ReadPacket<{ n: number }> = { pattern: "EVENT", data: { n: 1 } };

  it("serializes without FIFO-only fields", () => {
    const serializer = new SqsSerializer();
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
  const packet: ReadPacket<{ n: number }> = { pattern: "EVENT", data: { n: 1 } };

  it("serializes with groupId and deduplicationId", () => {
    const serializer = new SqsFifoSerializer();
    const message: { id: string } = serializer.serialize(packet);

    expect(message).toMatchObject({
      id: expect.any(String),
      body: JSON.stringify(packet),
      delaySeconds: 0,
      groupId: "nestjs",
      deduplicationId: message.id,
    });
  });
});
