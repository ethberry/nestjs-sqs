import { Injectable } from "@nestjs/common";
import type { CustomTransportStrategy, IncomingRequest } from "@nestjs/microservices";
import { Server } from "@nestjs/microservices";
import { NO_MESSAGE_HANDLER } from "@nestjs/microservices/constants";
import { Consumer } from "sqs-consumer";
import { Producer } from "sqs-producer";
import type { Message } from "@aws-sdk/client-sqs";

import type { ISqsServerOptions } from "./interfaces";
import { SqsSerializer } from "./sqs.serializer";
import { SqsDeserializer } from "./sqs.deserializer";

@Injectable()
export class SqsServer extends Server implements CustomTransportStrategy {
  private consumer: Consumer;
  private producer: Producer;

  constructor(protected readonly options: ISqsServerOptions["options"]) {
    super();

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  public createClient(): void {
    const { consumerOptions, producerOptions } = this.options;

    this.consumer = Consumer.create({
      ...consumerOptions,
      handleMessage: this.handleMessage.bind(this),
    });

    this.consumer.on("error", err => {
      this.logger.error(err.message);
    });

    this.consumer.on("processing_error", err => {
      this.logger.error(err.message);
    });

    this.consumer.on("timeout_error", err => {
      this.logger.error(err.message);
    });

    this.consumer.start();

    this.producer = Producer.create(producerOptions);
  }

  public listen(callback: () => void): void {
    if (!this.producer) {
      this.createClient();
    }
    callback();
  }

  public async handleMessage(message: Message): Promise<void> {
    const { pattern, data, id } = (await this.deserializer.deserialize(message)) as IncomingRequest;

    const handler = this.getHandlerByPattern(pattern);

    if (!handler) {
      const serializedPacket = this.serializer.serialize({
        id: data.id,
        status: "error",
        err: NO_MESSAGE_HANDLER,
      });
      await this.producer.send(serializedPacket);
      return;
    }

    const response$ = this.transformToObservable(await handler(data));
    this.send(response$, paket => {
      const serializedPacket = this.serializer.serialize({
        id,
        ...paket,
      });
      return this.producer.send(serializedPacket);
    });
  }

  public close(): void {
    this.consumer.stop();
  }

  protected initializeSerializer(options: ISqsServerOptions["options"]): void {
    this.serializer = options?.serializer ?? new SqsSerializer();
  }

  protected initializeDeserializer(options: ISqsServerOptions["options"]): void {
    this.deserializer = options?.deserializer ?? new SqsDeserializer();
  }

  unwrap<T>(): T {
    return [this.consumer, this.producer] as T;
  }

  on<EventKey extends string | number | symbol = string | number | symbol, EventCallback = any>(
    _event: EventKey,
    _callback: EventCallback,
  ) {
    throw new Error("Method is not supported in SQS mode.");
  }
}
