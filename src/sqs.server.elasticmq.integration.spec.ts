import { randomUUID } from "node:crypto";

import { Controller, INestApplication, Inject, Injectable, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { ClientProxy, ClientsModule, Ctx, MessagePattern, Payload } from "@nestjs/microservices";
import { DeleteMessageBatchCommand, ReceiveMessageCommand, SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { firstValueFrom } from "rxjs";

import { SqsFifoSerializer } from "./serializers";
import { SqsServer } from "./sqs.server";
import { SqsClient } from "./sqs.client";
import { SqsContext } from "./sqs.context";

const AWS_REGION = "elasticmq";
const INTEGRATION_ASYNC_MS = 15_000;
const ASYNC_SETTLE_MS = 200;
const SQS_SERVICE = "SQS_SERVICE";
const EVENT_NAME = "EVENT_NAME";
const NON_EXISTING_EVENT_NAME = "NON_EXISTING_EVENT_NAME";
/** Object-shaped `MessagePattern` (route key is `JSON.stringify` of this value). */
const OBJECT_PATTERN = { cmd: "sanity_object" } as const;
const CONTEXT_SANITY_PATTERN = "CONTEXT_SANITY_PATTERN";

const SAMPLE_MESSAGE_ATTRIBUTES = {
  Title: {
    DataType: "String",
    StringValue: "The Whistler",
  },
  Author: {
    DataType: "String",
    StringValue: "John Grisham",
  },
  WeeksOn: {
    DataType: "Number",
    StringValue: "6",
  },
};

function buildInboundSendParams(queueUrl: string, pattern: unknown, data: unknown, fifo = false) {
  return {
    MessageAttributes: SAMPLE_MESSAGE_ATTRIBUTES,
    MessageBody: JSON.stringify({ pattern, data }),
    QueueUrl: queueUrl,
    ...(fifo
      ? {
          MessageGroupId: "nestjs",
          MessageDeduplicationId: randomUUID(),
        }
      : {}),
  };
}

async function drainQueue(client: SQSClient, queueUrl: string): Promise<void> {
  for (let round = 0; round < 100; round++) {
    const out = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 0,
        VisibilityTimeout: 0,
      }),
    );
    const messages = out.Messages ?? [];
    if (messages.length === 0) {
      return;
    }
    await client.send(
      new DeleteMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: messages.map((m, i) => ({
          Id: `${round}-${i}`,
          ReceiptHandle: m.ReceiptHandle!,
        })),
      }),
    );
  }
}

async function waitForSpyCalls(spy: jest.SpyInstance, count: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (spy.mock.calls.length >= count) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`Expected ${count} spy calls, got ${spy.mock.calls.length} after ${timeoutMs}ms`);
}

@Injectable()
class SqsService {
  /** Filled when `receive3` runs (sanity check for `SqsContext`). */
  public lastInboundQueueUrl = "";

  constructor(
    @Inject(SQS_SERVICE)
    private readonly sqsClientProxy: ClientProxy,
  ) {}

  public receive<T = any>(data: T): Promise<T> {
    return Promise.resolve(data);
  }

  public receiveWithContext<T>(data: T, ctx: SqsContext): Promise<T> {
    this.lastInboundQueueUrl = ctx.getQueueUrl();
    return this.receive(data);
  }

  public emit(data: any): Promise<void> {
    const res = this.sqsClientProxy.emit<void, any>(EVENT_NAME, data);
    return firstValueFrom(res);
  }

  public send(data: any): Promise<any> {
    const res = this.sqsClientProxy.send<string, any>(EVENT_NAME, data);
    return firstValueFrom(res);
  }

  public error(data: any): Promise<any> {
    const res = this.sqsClientProxy.send<string, any>("NON_EXISTING_EVENT_NAME", data);
    return firstValueFrom(res);
  }
}

@Controller()
class SqsController {
  constructor(private readonly sqsService: SqsService) {}

  @MessagePattern(EVENT_NAME)
  public receive<T = any>(@Payload() data: T): Promise<T> {
    return this.sqsService.receive(data);
  }

  @MessagePattern(OBJECT_PATTERN)
  public receive2<T = any>(@Payload() data: T): Promise<T> {
    return this.sqsService.receive(data);
  }

  @MessagePattern(CONTEXT_SANITY_PATTERN)
  public receive3<T = any>(@Payload() data: T, @Ctx() ctx: SqsContext): Promise<T> {
    return this.sqsService.receiveWithContext(data, ctx);
  }
}

describe("SqsServer (standard queues, ElasticMQ)", () => {
  let consumerUrl: string;
  let producerUrl: string;

  let app: INestApplication;
  let sqsService: SqsService;
  let sqs: SQSClient;

  beforeAll(async () => {
    @Module({
      imports: [
        ConfigModule.forRoot({}),
        ClientsModule.registerAsync([
          {
            name: SQS_SERVICE,
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
              const baseUrl = configService.getOrThrow<string>("ELASTICMQ_URL");
              const consumerQueueUrl = `${baseUrl}/queue/producer`;
              const producerQueueUrl = `${baseUrl}/queue/consumer`;
              return {
                customClass: SqsClient,
                options: {
                  consumerUrl: producerQueueUrl,
                  producerUrl: consumerQueueUrl,
                  sqs: new SQSClient({
                    endpoint: baseUrl,
                    region: AWS_REGION,
                    credentials: {
                      accessKeyId: "x",
                      secretAccessKey: "x",
                    },
                  }),
                },
              };
            },
          },
        ]),
      ],
      controllers: [SqsController],
      providers: [SqsService],
    })
    class TestSqsModule {}

    const module: TestingModule = await Test.createTestingModule({
      imports: [TestSqsModule],
    }).compile();
    const configService = module.get(ConfigService);
    const baseUrl = configService.getOrThrow<string>("ELASTICMQ_URL");
    consumerUrl = `${baseUrl}/queue/producer`;
    producerUrl = `${baseUrl}/queue/consumer`;
    sqs = new SQSClient({
      endpoint: baseUrl,
      region: AWS_REGION,
      credentials: {
        accessKeyId: "x",
        secretAccessKey: "x",
      },
    });

    app = module.createNestApplication();
    app.connectMicroservice({
      strategy: new SqsServer({
        consumerOptions: {
          sqs,
          region: AWS_REGION,
          queueUrl: consumerUrl,
        },
        producerOptions: {
          sqs,
          region: AWS_REGION,
          queueUrl: producerUrl,
        },
      }),
    });
    await app.startAllMicroservices();

    // https://github.com/aws/aws-sdk-js-v3/issues/5211#issuecomment-1718372984
    // @ts-ignore
    sqsService = module.get<SqsService>(SqsService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should be defined (ElasticMQ, standard)", () => {
    expect(app).toBeDefined();
  });

  describe("SqsService (ElasticMQ, standard)", () => {
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
      logSpy = jest.spyOn(sqsService, "receive");
    });

    afterEach(() => {
      logSpy.mockClear();
    });

    it("should emit event (ElasticMQ, standard)", async () => {
      const data = { test: true };
      const result = await sqsService.emit(data);

      await waitForSpyCalls(logSpy, 1, INTEGRATION_ASYNC_MS);

      expect(result).toHaveLength(1);
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should receive event (ElasticMQ, standard)", async () => {
      const data = { test: true };
      const params = buildInboundSendParams(consumerUrl, EVENT_NAME, data);
      const result = await sqs.send(new SendMessageCommand(params));

      await waitForSpyCalls(logSpy, 1, INTEGRATION_ASYNC_MS);

      expect(result).toBeDefined();
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should send/receive event (ElasticMQ, standard)", async () => {
      const data = { test: true };
      const result = await sqsService.send(data);

      await waitForSpyCalls(logSpy, 1, INTEGRATION_ASYNC_MS);

      expect(result).toEqual(data);
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle absent handler (ElasticMQ, standard)", async () => {
      const data = { test: true };
      const params = buildInboundSendParams(consumerUrl, NON_EXISTING_EVENT_NAME, data);

      const result = await sqs.send(new SendMessageCommand(params));

      await new Promise(resolve => setTimeout(resolve, ASYNC_SETTLE_MS));

      expect(result).toBeDefined();
    });

    it("should route object MessagePattern (receive2, ElasticMQ, standard)", async () => {
      const data = { objectPattern: true };
      const params = buildInboundSendParams(consumerUrl, OBJECT_PATTERN, data);
      const result = await sqs.send(new SendMessageCommand(params));

      await waitForSpyCalls(logSpy, 1, INTEGRATION_ASYNC_MS);

      expect(result).toBeDefined();
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(data);
    });

    it("should pass SqsContext (receive3, ElasticMQ, standard)", async () => {
      sqsService.lastInboundQueueUrl = "";
      const data = { ctxSanity: true };
      const params = buildInboundSendParams(consumerUrl, CONTEXT_SANITY_PATTERN, data);
      const result = await sqs.send(new SendMessageCommand(params));

      await waitForSpyCalls(logSpy, 1, INTEGRATION_ASYNC_MS);

      expect(result).toBeDefined();
      expect(sqsService.lastInboundQueueUrl).toBe(consumerUrl);
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(data);
    });
  });
});

describe("SqsServer (FIFO queues, ElasticMQ)", () => {
  let consumerUrl: string;
  let producerUrl: string;

  let app: INestApplication;
  let sqsService: SqsService;
  let sqs: SQSClient;

  beforeAll(async () => {
    const serializer = new SqsFifoSerializer();

    @Module({
      imports: [
        ConfigModule.forRoot({}),
        ClientsModule.registerAsync([
          {
            name: SQS_SERVICE,
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
              const baseUrl = configService.getOrThrow<string>("ELASTICMQ_URL");
              const consumerQueueUrl = `${baseUrl}/queue/producer.fifo`;
              const producerQueueUrl = `${baseUrl}/queue/consumer.fifo`;
              return {
                customClass: SqsClient,
                options: {
                  consumerUrl: producerQueueUrl,
                  producerUrl: consumerQueueUrl,
                  sqs: new SQSClient({
                    endpoint: baseUrl,
                    region: AWS_REGION,
                    credentials: {
                      accessKeyId: "x",
                      secretAccessKey: "x",
                    },
                  }),
                  serializer,
                },
              };
            },
          },
        ]),
      ],
      controllers: [SqsController],
      providers: [SqsService],
    })
    class TestSqsModule {}

    const module: TestingModule = await Test.createTestingModule({
      imports: [TestSqsModule],
    }).compile();
    const configService = module.get(ConfigService);
    const baseUrl = configService.getOrThrow<string>("ELASTICMQ_URL");
    consumerUrl = `${baseUrl}/queue/producer.fifo`;
    producerUrl = `${baseUrl}/queue/consumer.fifo`;
    sqs = new SQSClient({
      endpoint: baseUrl,
      region: AWS_REGION,
      credentials: {
        accessKeyId: "x",
        secretAccessKey: "x",
      },
    });

    app = module.createNestApplication();
    app.connectMicroservice({
      strategy: new SqsServer({
        consumerOptions: {
          sqs,
          region: AWS_REGION,
          queueUrl: consumerUrl,
        },
        producerOptions: {
          sqs,
          region: AWS_REGION,
          queueUrl: producerUrl,
        },
        serializer,
      }),
    });
    await app.startAllMicroservices();

    // https://github.com/aws/aws-sdk-js-v3/issues/5211#issuecomment-1718372984
    // @ts-ignore
    sqsService = module.get<SqsService>(SqsService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should be defined (ElasticMQ, FIFO)", () => {
    expect(app).toBeDefined();
  });

  describe("SqsService (ElasticMQ, FIFO)", () => {
    let logSpy: jest.SpyInstance;

    beforeEach(async () => {
      await drainQueue(sqs, consumerUrl);
      await drainQueue(sqs, producerUrl);
      logSpy = jest.spyOn(sqsService, "receive");
    });

    afterEach(() => {
      logSpy.mockClear();
    });

    it("should emit event (ElasticMQ, FIFO)", async () => {
      const data = { test: true };
      const result = await sqsService.emit(data);

      await waitForSpyCalls(logSpy, 1, INTEGRATION_ASYNC_MS);

      expect(result).toHaveLength(1);
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should receive event (ElasticMQ, FIFO)", async () => {
      const data = { test: true };
      const params = buildInboundSendParams(consumerUrl, EVENT_NAME, data, true);
      const result = await sqs.send(new SendMessageCommand(params));

      await waitForSpyCalls(logSpy, 1, INTEGRATION_ASYNC_MS);

      expect(result).toBeDefined();
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should send/receive event (ElasticMQ, FIFO)", async () => {
      const data = { test: true };
      const result = await sqsService.send(data);

      await waitForSpyCalls(logSpy, 1, INTEGRATION_ASYNC_MS);

      expect(result).toEqual(data);
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle absent handler (ElasticMQ, FIFO)", async () => {
      const data = { test: true };
      const params = buildInboundSendParams(consumerUrl, NON_EXISTING_EVENT_NAME, data, true);

      const result = await sqs.send(new SendMessageCommand(params));

      await new Promise(resolve => setTimeout(resolve, ASYNC_SETTLE_MS));

      expect(result).toBeDefined();
    });

    it("should route object MessagePattern (receive2, ElasticMQ, FIFO)", async () => {
      const data = { objectPattern: true };
      const params = buildInboundSendParams(consumerUrl, OBJECT_PATTERN, data, true);
      const result = await sqs.send(new SendMessageCommand(params));

      await waitForSpyCalls(logSpy, 1, INTEGRATION_ASYNC_MS);

      expect(result).toBeDefined();
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(data);
    });

    it("should pass SqsContext (receive3, ElasticMQ, FIFO)", async () => {
      sqsService.lastInboundQueueUrl = "";
      const data = { ctxSanity: true };
      const params = buildInboundSendParams(consumerUrl, CONTEXT_SANITY_PATTERN, data, true);
      const result = await sqs.send(new SendMessageCommand(params));

      await waitForSpyCalls(logSpy, 1, INTEGRATION_ASYNC_MS);

      expect(result).toBeDefined();
      expect(sqsService.lastInboundQueueUrl).toBe(consumerUrl);
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(data);
    });
  });
});
