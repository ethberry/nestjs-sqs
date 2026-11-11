import type { Type } from "@nestjs/common";
import type { ClientProxy, Deserializer, Serializer } from "@nestjs/microservices";
import type { Message } from "@aws-sdk/client-sqs";
import { SQSClient } from "@aws-sdk/client-sqs";

import type { SqsClientInboundPacket } from "../types/index.js";

export interface ISqsClientOptions {
  /** Nest `ClientProxy` implementation — `SqsClient`. */
  customClass: Type<ClientProxy>;
  options: {
    /** Queue URL for **sending** requests/events (the server’s inbound queue). */
    producerUrl: string;
    /** Queue URL polled for **replies** (the server’s outbound / reply queue). */
    consumerUrl: string;
    /** AWS region for `sqs-producer` when no custom `sqs` client is passed. */
    region?: string;
    /** Shared AWS SDK v3 `SQSClient` for producer and consumer. */
    sqs?: SQSClient;
    /** Passed through to `sqs-producer` as `batchSize`. */
    batchSize?: number;
    /** Outgoing message shape; defaults to `SqsSerializer`. Use `SqsFifoSerializer` for FIFO queues. */
    serializer?: Serializer;
    /** Parsed reply `Message.Body`; defaults to `SqsDeserializer` producing `SqsClientInboundPacket` (Nest reply shape). */
    deserializer?: Deserializer<Message, SqsClientInboundPacket>;
  };
}
