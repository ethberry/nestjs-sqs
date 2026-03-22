import { SqsDeserializer } from "./sqs.deserializer";
import type { SqsClientInboundPacket } from "../types";

describe("SqsDeserializer", () => {
  it("parses server RPC packet (pattern + data + id)", () => {
    const d = new SqsDeserializer();
    const payload = { pattern: "x", data: { n: 1 }, id: "c1" };
    const expected = d.deserialize({ Body: JSON.stringify(payload) });
    expect(expected).toEqual(payload);
  });

  it("parses server event packet (pattern + data, no id)", () => {
    const d = new SqsDeserializer();
    const payload = { pattern: "evt", data: { n: 1 } };
    const expected = d.deserialize({ Body: JSON.stringify(payload) });
    expect(expected).toEqual(payload);
  });

  it("parses client reply packet (id + response)", () => {
    const d = new SqsDeserializer<SqsClientInboundPacket>();
    const payload = { id: "r1", response: { ok: true } };
    const expected = d.deserialize({ Body: JSON.stringify(payload) });
    expect(expected).toEqual(payload);
  });

  it("rejects pattern without data", () => {
    const d = new SqsDeserializer();
    expect(() => d.deserialize({ Body: JSON.stringify({ pattern: "only" }) })).toThrow("missing `data`");
  });

  it("rejects invalid JSON", () => {
    const d = new SqsDeserializer();
    expect(() => d.deserialize({ Body: "not-json" })).toThrow("not valid JSON");
  });
});
