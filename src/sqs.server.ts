import { Injectable } from "@nestjs/common";
import { CustomTransportStrategy, IncomingRequest, Server } from "@nestjs/microservices";
import { NO_MESSAGE_HANDLER } from "@nestjs/microservices/constants";
import { Consumer, SQSMessage } from "sqs-consumer";
import { Producer } from "sqs-producer";

import { ISqsServerOptions } from "./interfaces";
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
    const { consumerUrl, producerUrl, ...options } = this.options;

    this.consumer = Consumer.create({
      ...options,
      queueUrl: consumerUrl,
      handleMessage: this.handleMessage.bind(this),
    });

    this.producer = Producer.create({
      ...options,
      queueUrl: producerUrl,
    });
  }

  public listen(callback: () => void): void {
    this.createClient();
    this.consumer.start();
    callback();
  }

  public async handleMessage(message: SQSMessage): Promise<void> {
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
      void this.producer.send(serializedPacket);
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
}
