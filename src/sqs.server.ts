import { Injectable } from "@nestjs/common";
import type { CustomTransportStrategy, IncomingRequest } from "@nestjs/microservices";
import { Server } from "@nestjs/microservices";
import { NO_MESSAGE_HANDLER } from "@nestjs/microservices/constants";
import { defer, EMPTY, from, lastValueFrom } from "rxjs";
import { catchError, concatMap, concatWith, defaultIfEmpty, last, mergeMap } from "rxjs/operators";
import { Consumer } from "sqs-consumer";
import { Producer } from "sqs-producer";
import type { Message } from "@aws-sdk/client-sqs";

import type { ISqsServerOptions } from "./interfaces";
import { SqsSerializer } from "./serializers";
import { SqsDeserializer } from "./deserializers";

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

  public async handleMessage(message: Message): Promise<Message | undefined> {
    const { pattern, data, id } = (await this.deserializer.deserialize(message)) as IncomingRequest;

    const handler = this.getHandlerByPattern(pattern);

    if (!handler) {
      const serializedPacket = this.serializer.serialize({
        id: data.id,
        status: "error",
        err: NO_MESSAGE_HANDLER,
      });
      await this.producer.send(serializedPacket);
      return message;
    }

    const response$ = this.transformToObservable(await handler(data));

    const pipeline = response$.pipe(
      concatMap(async response => {
        await this.producer.send(
          this.serializer.serialize({
            id,
            response,
          }),
        );
      }),
      catchError(err =>
        defer(() =>
          from(
            this.producer.send(
              this.serializer.serialize({
                id,
                err,
              }),
            ),
          ).pipe(mergeMap(() => EMPTY)),
        ),
      ),
      concatWith(
        defer(() =>
          from(
            this.producer.send(
              this.serializer.serialize({
                id,
                isDisposed: true,
              }),
            ),
          ),
        ),
      ),
      defaultIfEmpty(undefined),
      last(),
    );

    await lastValueFrom(pipeline);
    return message;
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
