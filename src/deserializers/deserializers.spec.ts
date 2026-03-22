import { SqsDeserializer } from "./sqs.deserializer";

describe("SqsDeserializer", () => {
  it("parses Message.Body JSON", () => {
    const d = new SqsDeserializer();
    const payload = { pattern: "x", data: 1 };
    expect(d.deserialize({ Body: JSON.stringify(payload) })).toEqual(payload);
  });
});
