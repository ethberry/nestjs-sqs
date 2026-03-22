import type { Type } from "@nestjs/common";
import type { ClientProxy, Deserializer, Serializer } from "@nestjs/microservices";
import type { Message } from "@aws-sdk/client-sqs";
import type { ConsumerOptions } from "sqs-consumer";
import type { ProducerOptions } from "sqs-producer";

import type { SqsServerInboundPacket } from "../types/sqs-packets";

export interface ISqsServerOptions {
  /** Nest `ClientProxy` class paired with this server (typically `SqsClient`). */
  customClass: Type<ClientProxy>;
  options: {
    /** Options for [`sqs-consumer`](https://github.com/bbc/sqs-consumer) `Consumer.create()` (inbound queue, `sqs` client, etc.). */
    consumerOptions: ConsumerOptions;
    /** Options for [`sqs-producer`](https://github.com/bbc/sqs-producer) `Producer.create()` (outbound / reply queue). */
    producerOptions: ProducerOptions;
    /** Outgoing message shape; defaults to `SqsSerializer`. Use `SqsFifoSerializer` for FIFO queues. */
    serializer?: Serializer;
    /** Parsed inbound `Message.Body`; defaults to `SqsDeserializer` producing `SqsServerInboundPacket` (Nest request/event shape). */
    deserializer?: Deserializer<Message, SqsServerInboundPacket>;
  };
}
