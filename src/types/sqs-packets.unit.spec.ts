import { isSqsServerRpcPacket, assertSqsMessageBody } from "./sqs-packets";

describe("sqs-packets", () => {
  describe("isSqsServerRpcPacket", () => {
    it("is true when id is a string", () => {
      expect(isSqsServerRpcPacket({ pattern: "p", data: {}, id: "1" })).toBe(true);
    });

    it("is false for event packets without id", () => {
      expect(isSqsServerRpcPacket({ pattern: "p", data: {} })).toBe(false);
    });
  });

  describe("assertSqsMessageBody", () => {
    it("throws when body is missing", () => {
      expect(() => assertSqsMessageBody(undefined)).toThrow("missing or empty");
    });
  });
});
