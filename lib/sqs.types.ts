import type { ConsumerOptions } from "sqs-consumer";
import type { Producer } from "sqs-producer";
import type { SQS } from "aws-sdk";
import type { ModuleMetadata, Type } from "@nestjs/common";

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

export interface ISqsModuleOptionsFactory {
  createOptions(): Promise<ISqsOptions> | ISqsOptions;
}

export interface ISqsModuleAsyncOptions extends Pick<ModuleMetadata, "imports"> {
  useExisting?: Type<ISqsModuleOptionsFactory>;
  useClass?: Type<ISqsModuleOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<ISqsOptions> | ISqsOptions;
  inject?: any[];
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
  eventName: string;
}
