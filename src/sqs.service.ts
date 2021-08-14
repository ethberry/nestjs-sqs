import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Consumer } from "sqs-consumer";
import { Producer } from "sqs-producer";
import { DiscoveryService } from "@nestjs-plus/discovery";
import { SQS } from "aws-sdk";
import type { QueueAttributeName } from "aws-sdk/clients/sqs";

import { IMessage, QueueName, ISqsConsumerEventHandlerMeta, ISqsMessageHandlerMeta, ISqsOptions } from "./interfaces";
import { SQS_CONSUMER_EVENT_HANDLER, SQS_CONSUMER_METHOD, SQS_OPTIONS } from "./sqs.constants";

@Injectable()
export class SqsService implements OnModuleInit, OnModuleDestroy {
  public readonly consumers = new Map<QueueName, Consumer>();
  public readonly producers = new Map<QueueName, Producer>();

  private readonly logger = new Logger("SqsService");

  public constructor(
    @Inject(SQS_OPTIONS) public readonly options: ISqsOptions,
    private readonly discover: DiscoveryService,
  ) {}

  public async onModuleInit(): Promise<void> {
    const messageHandlers = await this.discover.providerMethodsWithMetaAtKey<ISqsMessageHandlerMeta>(
      SQS_CONSUMER_METHOD,
    );
    const eventHandlers = await this.discover.providerMethodsWithMetaAtKey<ISqsConsumerEventHandlerMeta>(
      SQS_CONSUMER_EVENT_HANDLER,
    );

    this.options.consumers?.forEach(options => {
      const { name, ...consumerOptions } = options;
      if (this.consumers.has(name)) {
        throw new Error(`Consumer already exists: ${name}`);
      }

      const metadata = messageHandlers.find(({ meta }) => meta.name === name);
      if (!metadata) {
        this.logger.warn(`No metadata found for: ${name}`);
      }

      const isBatchHandler = metadata?.meta.batch === true;
      const consumer = Consumer.create({
        ...consumerOptions,
        ...(isBatchHandler
          ? {
              handleMessageBatch: metadata?.discoveredMethod.handler.bind(
                metadata.discoveredMethod.parentClass.instance,
              ),
            }
          : { handleMessage: metadata?.discoveredMethod.handler.bind(metadata.discoveredMethod.parentClass.instance) }),
      });

      const eventsMetadata = eventHandlers.filter(({ meta }) => meta.name === name);
      for (const eventMetadata of eventsMetadata) {
        if (eventMetadata) {
          consumer.addListener(
            eventMetadata.meta.eventName,
            eventMetadata.discoveredMethod.handler.bind(metadata?.discoveredMethod.parentClass.instance),
          );
        }
      }
      this.consumers.set(name, consumer);
    });

    this.options.producers?.forEach(options => {
      const { name, ...producerOptions } = options;
      if (this.producers.has(name)) {
        throw new Error(`Producer already exists: ${name}`);
      }

      const producer = Producer.create(producerOptions);
      this.producers.set(name, producer);
    });

    for (const consumer of this.consumers.values()) {
      consumer.start();
    }
  }

  public onModuleDestroy(): void {
    for (const consumer of this.consumers.values()) {
      consumer.stop();
    }
  }

  private getQueueInfo(name: QueueName) {
    if (!this.consumers.has(name) && !this.producers.has(name)) {
      throw new Error(`Consumer/Producer does not exist: ${name}`);
    }

    const { sqs, queueUrl } = (this.consumers.get(name) ?? this.producers.get(name)) as {
      sqs: SQS;
      queueUrl: string;
    };
    if (!sqs) {
      throw new Error("SQS instance does not exist");
    }

    return {
      sqs,
      queueUrl,
    };
  }

  public async purgeQueue(name: QueueName): Promise<any> {
    const { sqs, queueUrl } = this.getQueueInfo(name);
    return sqs
      .purgeQueue({
        QueueUrl: queueUrl,
      })
      .promise();
  }

  public async getQueueAttributes(name: QueueName): Promise<{ [key in QueueAttributeName]: string } | undefined> {
    const { sqs, queueUrl } = this.getQueueInfo(name);
    const response = await sqs
      .getQueueAttributes({
        QueueUrl: queueUrl,
        AttributeNames: ["All"],
      })
      .promise();
    return response.Attributes;
  }

  public getProducerQueueSize(name: QueueName): Promise<number> {
    if (!this.producers.has(name)) {
      throw new Error(`Producer does not exist: ${name}`);
    }

    return this.producers.get(name)!.queueSize();
  }

  public send<T = any>(name: QueueName, payload: IMessage<T> | IMessage<T>[]): Promise<any> {
    if (!this.producers.has(name)) {
      throw new Error(`Producer does not exist: ${name}`);
    }

    const originalMessages = Array.isArray(payload) ? payload : [payload];
    const messages = originalMessages.map(message => {
      let body = message.body;
      if (typeof body !== "string") {
        body = JSON.stringify(body) as any;
      }

      return {
        ...message,
        body,
      };
    });

    const producer = this.producers.get(name)!;
    return producer.send(messages as any[]);
  }
}
