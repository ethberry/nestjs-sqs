import { Logger } from "@nestjs/common";
import type { PacketId, ProducerDeserializer, ReadPacket, WritePacket } from "@nestjs/microservices";
import { ClientProxy } from "@nestjs/microservices";
import type { Message } from "@aws-sdk/client-sqs";
import { randomStringGenerator } from "@nestjs/common/utils/random-string-generator.util";
import { Producer } from "sqs-producer";
import { Consumer } from "sqs-consumer";

import { ISqsClientOptions } from "./interfaces";
import { SqsDeserializer } from "./deserializers";
import { SqsSerializer } from "./serializers";
import type { SqsClientInboundPacket } from "./types";

/** Wire shape from {@link SqsSerializer} / {@link SqsFifoSerializer} before SQS send. */
interface IProducerWireMessage {
  id: string;
  body: string;
  delaySeconds?: number;
  groupId?: string;
  deduplicationId?: string;
}

/**
 * Tuple returned by {@link SqsClient.unwrap} — use `unwrap<SqsClientUnwrapped>()` for typed access.
 */
export type SqsClientUnwrapped = readonly [Consumer, Producer];

export class SqsClient extends ClientProxy {
  private producer: Producer;
  private consumer: Consumer;

  private readonly logger = new Logger(SqsClient.name);

  constructor(protected readonly options: ISqsClientOptions["options"]) {
    super();

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  public createClient(): void {
    const { producerUrl, consumerUrl, ...options } = this.options;
    this.consumer = Consumer.create({
      sqs: options.sqs,
      queueUrl: consumerUrl,
      handleMessage: this.handleMessage.bind(this),
      ...(consumerUrl.endsWith(".fifo") ? { suppressFifoWarning: true } : {}),
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

    this.producer = Producer.create({
      queueUrl: producerUrl,
      region: options.region,
      sqs: options.sqs,
      batchSize: options.batchSize,
    });
  }

  protected publish(partialPacket: ReadPacket, callback: (packet: WritePacket) => void): () => void {
    const packet = this.assignPacketId(partialPacket);
    const serializedPacket = this.serializer.serialize(packet) as IProducerWireMessage;

    // Register before send so a reply cannot be handled before the id exists in `routingMap`.
    this.routingMap.set(packet.id, callback);
    const sendPromise = this.producer.send(serializedPacket);
    void sendPromise.catch(() => {
      this.routingMap.delete(packet.id);
    });
    return () => this.routingMap.delete(packet.id);
  }

  protected dispatchEvent<T = unknown>(packet: ReadPacket): Promise<T> {
    const serializedPacket = this.serializer.serialize(packet) as IProducerWireMessage;
    return this.producer.send(serializedPacket) as Promise<T>;
  }

  public connect(): Promise<void> {
    if (!this.producer) {
      this.createClient();
    }
    return Promise.resolve();
  }

  public async handleMessage(message: Message): Promise<Message | undefined> {
    const { id, response, err, status, isDisposed } = await this.deserializer.deserialize(message);
    const callback = this.routingMap.get(id) as ((packet: WritePacket) => void) | undefined;

    if (!callback) {
      // Drop stale/unknown replies so they are not redelivered forever. On FIFO queues, an
      // undeleted message with the same MessageGroupId as real traffic can block processing.
      return message;
    }

    callback({
      response,
      err,
      status,
      isDisposed,
    });
    return message;
  }

  public close(): void {
    if (this.consumer) {
      this.consumer.stop();
    }
  }

  protected assignPacketId(packet: ReadPacket): ReadPacket & PacketId {
    const id = randomStringGenerator();
    return Object.assign(packet, { id });
  }

  protected initializeSerializer(options: ISqsClientOptions["options"]): void {
    this.serializer = options?.serializer ?? new SqsSerializer();
  }

  protected initializeDeserializer(options: ISqsClientOptions["options"]): void {
    this.deserializer = (options?.deserializer ??
      new SqsDeserializer<SqsClientInboundPacket>()) as ProducerDeserializer;
  }

  unwrap<T>(): T {
    if (!this.consumer) {
      throw new Error(
        'Not initialized. Please call the "listen"/"startAllMicroservices" method before accessing the server.',
      );
    }
    return [this.consumer, this.producer] as T;
  }
}
