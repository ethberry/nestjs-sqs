import type { Message } from "@aws-sdk/client-sqs";

import { SqsContext } from "./sqs.context";

describe("SqsContext", () => {
  it("exposes message, queue URL, and pattern", () => {
    const message = { Body: "{}", MessageId: "mid-1" } as Message;
    const ctx = new SqsContext([message, "https://sqs.example/queue", "my.pattern"]);

    expect(ctx.getMessage()).toBe(message);
    expect(ctx.getQueueUrl()).toBe("https://sqs.example/queue");
    expect(ctx.getPattern()).toBe("my.pattern");
    expect(ctx.getArgs()).toEqual([message, "https://sqs.example/queue", "my.pattern"]);
  });
});
