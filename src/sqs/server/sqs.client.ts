import { Logger } from "@nestjs/common";
import { ClientProxy, PacketId, ReadPacket, WritePacket } from "@nestjs/microservices";
import { ISqsClientOptions } from "../interfaces";
import { Producer } from "sqs-producer";
import { Consumer, SQSMessage } from "sqs-consumer";
import { SQS } from "aws-sdk";
import { randomStringGenerator } from "@nestjs/common/utils/random-string-generator.util";
import { SqsDeserializer } from "./sqs.deserializer";
import { SqsSerializer } from "./sqs.serializer";

export class SqsClient extends ClientProxy {
  private readonly logger = new Logger(SqsClient.name);
  private sqs: SQS;
  private producer: Producer;
  private consumer: Consumer;

  constructor(protected readonly options: ISqsClientOptions["options"]) {
    super();

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  public createClient(): void {
    this.consumer = Consumer.create({
      ...this.options,
      waitTimeSeconds: 1,
      batchSize: 1,
      terminateVisibilityTimeout: true,
      messageAttributeNames: ["All"],
      handleMessage: this.handleMessage.bind(this),
    });

    this.consumer.on("error", err => {
      console.error(err.message);
    });

    this.consumer.on("processing_error", err => {
      console.error(err.message);
    });

    this.consumer.on("timeout_error", err => {
      console.error(err.message);
    });

    this.consumer.start();

    this.producer = Producer.create(this.options);
  }

  protected publish(partialPacket: ReadPacket, callback: (packet: WritePacket) => any): () => void {
    const packet = this.assignPacketId(partialPacket);
    const serializedPacket = this.serializer.serialize(packet);
    void this.producer.send(serializedPacket).then(() => {
      this.routingMap.set(packet.id, callback);
    });
    return () => this.routingMap.delete(serializedPacket.MessageId);
  }

  protected dispatchEvent(packet: ReadPacket): Promise<any> {
    const serializedPacket = this.serializer.serialize(packet);
    return this.producer.send(serializedPacket);
  }

  public connect(): Promise<any> {
    this.createClient();
    return Promise.resolve(this.producer);
  }

  public async handleMessage(message: SQSMessage): Promise<void> {
    const { id, response } = await this.deserializer.deserialize(message);
    const callback = this.routingMap.get(id);
    if (!callback) {
      return undefined;
    }
    // eslint-disable-next-line node/no-callback-literal
    callback({
      response,
    });
  }

  public close(): void {
    this.consumer.stop();
  }

  protected assignPacketId(packet: ReadPacket): ReadPacket & PacketId {
    const id = randomStringGenerator();
    return Object.assign(packet, { id });
  }

  protected initializeSerializer(options: ISqsClientOptions["options"]): void {
    this.serializer = options?.serializer ?? new SqsSerializer();
  }

  protected initializeDeserializer(options: ISqsClientOptions["options"]): void {
    this.deserializer = options?.deserializer ?? new SqsDeserializer();
  }
}
