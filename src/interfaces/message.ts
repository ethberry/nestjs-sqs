import { SQS } from "aws-sdk";

export enum TestQueue {
  Test = "test",
  DLQ = "test-dead",
}

export interface IMessage<T = any> {
  id: string;
  body: T;
  groupId?: string;
  deduplicationId?: string;
  delaySeconds?: number;
  messageAttributes?: SQS.MessageBodyAttributeMap;
}
