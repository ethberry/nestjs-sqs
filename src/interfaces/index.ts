import type { ConsumerOptions } from "sqs-consumer";
import type { Producer } from "sqs-producer";
import type { SQS } from "aws-sdk";

export type ProducerOptions = Parameters<typeof Producer.create>[0];
export type QueueName = string;

export type SqsConsumerOptions = Omit<ConsumerOptions, "handleMessage" | "handleMessageBatch"> & {
  name: QueueName;
};

export type SqsProducerOptions = ProducerOptions & {
  name: QueueName;
};

export interface ISqsOptions {
  consumers?: SqsConsumerOptions[];
  producers?: SqsProducerOptions[];
}

export interface IMessage<T = any> {
  id: string;
  body: T;
  groupId?: string;
  deduplicationId?: string;
  delaySeconds?: number;
  messageAttributes?: SQS.MessageBodyAttributeMap;
}

export interface ISqsMessageHandlerMeta {
  name: string;
  batch?: boolean;
}

export interface ISqsConsumerEventHandlerMeta {
  name: string;
  eventName: SqsConsumerEvent;
}

export enum SqsConsumerEvent {
  RESPONSE_PROCESSED = "response_processed",
  EMPTY = "empty",
  MESSAGE_RECEIVED = "message_received",
  MESSAGE_PROCESSED = "message_processed",
  ERROR = "error",
  TIMEOUT_ERROR = "timeout_error",
  PROCESSING_ERROR = "processing_error",
  STOPPED = "stopped",
}
