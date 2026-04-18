import { Injectable } from "@nestjs/common";
import { isString } from "@nestjs/common/utils/shared.utils";
import type { ConsumerDeserializer, CustomTransportStrategy } from "@nestjs/microservices";
import { Server } from "@nestjs/microservices";
import { NO_EVENT_HANDLER, NO_MESSAGE_HANDLER } from "@nestjs/microservices/constants";
import { defer, EMPTY, from, lastValueFrom } from "rxjs";
import { catchError, defaultIfEmpty, last, mergeMap } from "rxjs/operators";
import type { StopOptions } from "sqs-consumer";
import { Consumer } from "sqs-consumer";
import { Producer } from "sqs-producer";
import type { Message } from "@aws-sdk/client-sqs";

import type { ISqsServerOptions } from "./interfaces";
import { SqsSerializer } from "./serializers";
import { SqsDeserializer } from "./deserializers";
import { isSqsServerRpcPacket } from "./types/sqs-packets";
import { SqsContext } from "./sqs.context";

/** Wire shape from {@link SqsSerializer} / {@link SqsFifoSerializer} before SQS send. */
interface IProducerWireMessage {
  id: string;
  body: string;
  delaySeconds?: number;
  groupId?: string;
  deduplicationId?: string;
}

/**
 * Tuple returned by {@link SqsServer.unwrap} — use `unwrap<SqsServerUnwrapped>()` for typed access.
 */
export type SqsServerUnwrapped = readonly [Consumer, Producer];

@Injectable()
export class SqsServer extends Server implements CustomTransportStrategy {
  private consumer: Consumer;
  private producer: Producer;
  private consumerQueueUrl = "";

  constructor(protected readonly options: ISqsServerOptions["options"]) {
    super();
    this.setTransportId(Symbol.for("@ethberry/nestjs-sqs"));

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  public createClient(): void {
    const { consumerOptions, producerOptions } = this.options;

    this.consumerQueueUrl = consumerOptions.queueUrl ?? "";
    this.consumer = Consumer.create({
      ...consumerOptions,
      handleMessage: this.handleMessage.bind(this),
      ...(this.consumerQueueUrl.endsWith(".fifo") ? { suppressFifoWarning: true } : {}),
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

  private async sendProducerMessage(serialized: IProducerWireMessage): Promise<void> {
    await this.producer.send(serialized);
  }

  public listen(callback: () => void): void {
    if (!this.producer) {
      this.createClient();
    }
    callback();
  }

  public async handleMessage(message: Message): Promise<Message | undefined> {
    const packet = await this.deserializer.deserialize(message);
    const pattern = isString(packet.pattern) ? packet.pattern : JSON.stringify(packet.pattern);
    const sqsContext = new SqsContext([message, this.consumerQueueUrl, pattern]);

    if (!isSqsServerRpcPacket(packet)) {
      if (!this.getHandlerByPattern(pattern)) {
        this.logger.error(NO_EVENT_HANDLER`${pattern}`);
        // Return the message so sqs-consumer deletes it; otherwise the same undeliverable
        // event would stay in the queue and be redelivered indefinitely.
        return message;
      }
      await this.handleEvent(pattern, packet, sqsContext);
      return message;
    }

    const { data, id } = packet;
    const handler = this.getHandlerByPattern(pattern);

    if (!handler) {
      const serializedPacket = this.serializer.serialize({
        id: data.id,
        status: "error",
        err: NO_MESSAGE_HANDLER,
      }) as IProducerWireMessage;
      await this.sendProducerMessage(serializedPacket);
      return message;
    }

    await (this.onProcessingStartHook(this.transportId!, sqsContext, async () => {
      const response$ = this.transformToObservable(await handler(data, sqsContext));

      // One SQS reply per RPC: Nest ClientProxy must get `response` and `isDisposed` in the same
      // callback (see createObserver in @nestjs/microservices). Sending two messages (response,
      // then dispose) breaks on standard queues (no ordering) and can emit dispose-only → EmptyError.
      // `undefined` becomes `null` so `response !== undefined` in Nest and the client gets one `next`.
      const pipeline = response$.pipe(
        defaultIfEmpty(undefined),
        last(),
        mergeMap(async response => {
          const resolved = response === undefined ? null : response;
          await this.sendProducerMessage(
            this.serializer.serialize({
              id,
              isDisposed: true,
              response: resolved,
            }) as IProducerWireMessage,
          );
        }),
        catchError(err =>
          defer(() =>
            from(
              this.sendProducerMessage(
                this.serializer.serialize({
                  id,
                  err,
                }) as IProducerWireMessage,
              ),
            ).pipe(mergeMap(() => EMPTY)),
          ),
        ),
      );

      await lastValueFrom(pipeline);
    }) as unknown as Promise<void>);

    return message;
  }

  /**
   * Stops the SQS consumer. Pass `{ abort: true }` to cancel in-flight polls (see sqs-consumer {@link StopOptions}).
   * For graceful shutdown, set `pollingCompleteWaitTimeMs` on {@link ISqsServerOptions.options.consumerOptions} so `stop()` can wait for in-flight handlers.
   */
  public close(options?: StopOptions): void {
    this.consumer?.stop(options);
  }

  protected initializeSerializer(options: ISqsServerOptions["options"]): void {
    this.serializer = options?.serializer ?? new SqsSerializer();
  }

  protected initializeDeserializer(options: ISqsServerOptions["options"]): void {
    this.deserializer = (options?.deserializer ?? new SqsDeserializer()) as ConsumerDeserializer;
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
