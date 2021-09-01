import { Logger } from "@nestjs/common";
import { ClientProxy, ReadPacket, WritePacket } from "@nestjs/microservices";
import { ISqsClientOptions } from "../interfaces";
import { Producer } from "sqs-producer";
import { SQS } from "aws-sdk";
import { SqsDeserializer } from "./sqs.deserializer";
import { SqsSerializer } from "./sqs.serializer";

export class SqsClient extends ClientProxy {
  private readonly logger = new Logger(SqsClient.name);
  private sqs: SQS;
  private producer: Producer;

  constructor(protected readonly options: ISqsClientOptions["options"]) {
    super();

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  public createClient(): void {
    this.producer = Producer.create(this.options);
  }

  protected publish(_partialPacket: ReadPacket, _callback: (packet: WritePacket) => any): () => void {
    return () => null;
  }

  protected dispatchEvent(packet: ReadPacket): Promise<any> {
    const serializedPacket = this.serializer.serialize(packet);
    return this.producer.send(serializedPacket);
  }

  public connect(): Promise<any> {
    this.createClient();
    return Promise.resolve(this.producer);
  }

  public close(): void {
    // do nothing
  }

  protected initializeSerializer(options: ISqsClientOptions["options"]): void {
    this.serializer = options?.serializer ?? new SqsSerializer();
  }

  protected initializeDeserializer(options: ISqsClientOptions["options"]): void {
    this.deserializer = options?.deserializer ?? new SqsDeserializer();
  }
}
