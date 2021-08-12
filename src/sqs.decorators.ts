import { SetMetadata } from "@nestjs/common";

import { SQS_CONSUMER_EVENT_HANDLER, SQS_CONSUMER_METHOD } from "./sqs.constants";
import { SqsConsumerEvent } from "./sqs.types";

export const SqsMessageHandler = (name: string, batch?: boolean): ((target: any, key?: any, descriptor?: any) => any) =>
  SetMetadata(SQS_CONSUMER_METHOD, { name, batch });

export const SqsConsumerEventHandler = (
  name: string,
  eventName: SqsConsumerEvent,
): ((target: any, key?: any, descriptor?: any) => any) => SetMetadata(SQS_CONSUMER_EVENT_HANDLER, { name, eventName });
