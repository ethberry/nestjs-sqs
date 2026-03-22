import { BaseRpcContext } from "@nestjs/microservices";
import type { Message } from "@aws-sdk/client-sqs";

/** Tuple stored in {@link SqsContext}: raw message, consumer queue URL, normalized pattern. */
export type SqsContextArgs<M extends Message = Message> = [message: M, queueUrl: string, pattern: string];

/**
 * Transport context for SQS handlers (same role as Nest's `RmqContext` / `RedisContext`).
 * Use with `@Ctx()` to access the raw SQS message and queue URL.
 *
 * @typeParam M - Narrow the AWS `Message` type if you use a custom SQS client payload shape.
 */
export class SqsContext<M extends Message = Message> extends BaseRpcContext<SqsContextArgs<M>> {
  constructor(args: SqsContextArgs<M>) {
    super(args);
  }

  /** The SQS message received by the consumer (body, attributes, receipt handle, etc.). */
  getMessage(): M {
    return this.args[0];
  }

  /** Queue URL configured for the inbound consumer. */
  getQueueUrl(): string {
    return this.args[1];
  }

  /** Normalized route key for the Nest pattern. */
  getPattern(): string {
    return this.args[2];
  }
}
