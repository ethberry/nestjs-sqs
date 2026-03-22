import { randomUUID } from "node:crypto";

import { Controller, INestApplication, Inject, Injectable, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { ClientProxy, ClientsModule, MessagePattern } from "@nestjs/microservices";
import {
  CreateQueueCommand,
  GetQueueUrlCommand,
  ListQueuesCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { firstValueFrom } from "rxjs";

import { SqsFifoSerializer } from "./serializers";
import { SqsServer } from "./sqs.server";
import { SqsClient } from "./sqs.client";

const AWS_REGION = "us-east-1";
const SQS_SERVICE = "SQS_SERVICE";
const EVENT_NAME = "EVENT_NAME";
const NON_EXISTING_EVENT_NAME = "NON_EXISTING_EVENT_NAME";

@Injectable()
class SqsService {
  constructor(
    @Inject(SQS_SERVICE)
    private readonly sqsClientProxy: ClientProxy,
  ) {}

  public receive<T = any>(data: T): Promise<T> {
    return Promise.resolve(data);
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
  public receive<T = any>(data: T): Promise<T> {
    return this.sqsService.receive(data);
  }
}

async function waitForSqs(client: SQSClient): Promise<void> {
  for (let i = 0; i < 45; i++) {
    try {
      await client.send(new ListQueuesCommand({}));
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error("LocalStack SQS did not become ready in time");
}

async function ensureQueueUrl(client: SQSClient, name: string, fifo: boolean): Promise<string> {
  try {
    const { QueueUrl } = await client.send(new GetQueueUrlCommand({ QueueName: name }));
    if (QueueUrl) {
      return QueueUrl;
    }
  } catch {
    // create below
  }
  await client.send(
    new CreateQueueCommand({
      QueueName: name,
      ...(fifo
        ? {
            Attributes: {
              FifoQueue: "true",
              ContentBasedDeduplication: "false",
            },
          }
        : {}),
    }),
  );
  const { QueueUrl } = await client.send(new GetQueueUrlCommand({ QueueName: name }));
  if (!QueueUrl) {
    throw new Error(`Could not resolve queue URL for ${name}`);
  }
  return QueueUrl;
}

describe("SqsServer (standard queues, LocalStack)", () => {
  let consumerUrl: string;
  let producerUrl: string;

  let app: INestApplication;
  let sqsService: SqsService;
  let sqs: SQSClient;

  beforeAll(async () => {
    const configBootstrap = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
    }).compile();
    const configForClient = configBootstrap.get(ConfigService);
    const baseUrl = configForClient.getOrThrow<string>("LOCALSTACK_URL");
    sqs = new SQSClient({
      endpoint: baseUrl,
      region: AWS_REGION,
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    });
    await waitForSqs(sqs);
    consumerUrl = await ensureQueueUrl(sqs, "producer", false);
    producerUrl = await ensureQueueUrl(sqs, "consumer", false);
    await configBootstrap.close();

    @Module({
      imports: [
        ConfigModule.forRoot({}),
        ClientsModule.registerAsync([
          {
            name: SQS_SERVICE,
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
              const endpoint = configService.getOrThrow<string>("LOCALSTACK_URL");
              return {
                customClass: SqsClient,
                options: {
                  consumerUrl: producerUrl,
                  producerUrl: consumerUrl,
                  sqs: new SQSClient({
                    endpoint,
                    region: AWS_REGION,
                    credentials: {
                      accessKeyId: "test",
                      secretAccessKey: "test",
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

  it("should be defined (LocalStack, standard)", () => {
    expect(app).toBeDefined();
  });

  describe("SqsService (LocalStack, standard)", () => {
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
      logSpy = jest.spyOn(sqsService, "receive");
    });

    afterEach(() => {
      logSpy.mockClear();
    });

    it("should emit event (LocalStack, standard)", async () => {
      const data = { test: true };
      const result = await sqsService.emit(data);

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(result).toHaveLength(1);
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should receive event (LocalStack, standard)", async () => {
      const data = { test: true };
      const params = {
        MessageAttributes: {
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
        },
        MessageBody: JSON.stringify({ pattern: EVENT_NAME, data }),
        QueueUrl: consumerUrl,
      };
      const result = await sqs.send(new SendMessageCommand(params));

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(result).toBeDefined();
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should send/receive event (LocalStack, standard)", async () => {
      const data = { test: true };
      const result = await sqsService.send(data);

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(result).toEqual(data);
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle absent handler (LocalStack, standard)", async () => {
      const data = { test: true };
      const params = {
        MessageAttributes: {
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
        },
        MessageBody: JSON.stringify({ pattern: NON_EXISTING_EVENT_NAME, data }),
        QueueUrl: consumerUrl,
      };

      const result = await sqs.send(new SendMessageCommand(params));

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(result).toBeDefined();
    });
  });
});

describe("SqsServer (FIFO queues, LocalStack)", () => {
  let consumerUrl: string;
  let producerUrl: string;

  let app: INestApplication;
  let sqsService: SqsService;
  let sqs: SQSClient;

  beforeAll(async () => {
    const serializer = new SqsFifoSerializer();

    const configBootstrap = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
    }).compile();
    const configForClient = configBootstrap.get(ConfigService);
    const baseUrl = configForClient.getOrThrow<string>("LOCALSTACK_URL");
    sqs = new SQSClient({
      endpoint: baseUrl,
      region: AWS_REGION,
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    });
    await waitForSqs(sqs);
    consumerUrl = await ensureQueueUrl(sqs, "producer.fifo", true);
    producerUrl = await ensureQueueUrl(sqs, "consumer.fifo", true);
    await configBootstrap.close();

    @Module({
      imports: [
        ConfigModule.forRoot({}),
        ClientsModule.registerAsync([
          {
            name: SQS_SERVICE,
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
              const endpoint = configService.getOrThrow<string>("LOCALSTACK_URL");
              return {
                customClass: SqsClient,
                options: {
                  consumerUrl: producerUrl,
                  producerUrl: consumerUrl,
                  sqs: new SQSClient({
                    endpoint,
                    region: AWS_REGION,
                    credentials: {
                      accessKeyId: "test",
                      secretAccessKey: "test",
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

  it("should be defined (LocalStack, FIFO)", () => {
    expect(app).toBeDefined();
  });

  describe("SqsService (LocalStack, FIFO)", () => {
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
      logSpy = jest.spyOn(sqsService, "receive");
    });

    afterEach(() => {
      logSpy.mockClear();
    });

    it("should emit event (LocalStack, FIFO)", async () => {
      const data = { test: true };
      const result = await sqsService.emit(data);

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(result).toHaveLength(1);
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should receive event (LocalStack, FIFO)", async () => {
      const data = { test: true };
      const params = {
        MessageAttributes: {
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
        },
        MessageBody: JSON.stringify({ pattern: EVENT_NAME, data }),
        QueueUrl: consumerUrl,
        MessageGroupId: "test-group",
        MessageDeduplicationId: randomUUID(),
      };
      const result = await sqs.send(new SendMessageCommand(params));

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(result).toBeDefined();
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should send/receive event (LocalStack, FIFO)", async () => {
      const data = { test: true };
      const result = await sqsService.send(data);

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(result).toEqual(data);
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle absent handler (LocalStack, FIFO)", async () => {
      const data = { test: true };
      const params = {
        MessageAttributes: {
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
        },
        MessageBody: JSON.stringify({ pattern: NON_EXISTING_EVENT_NAME, data }),
        QueueUrl: consumerUrl,
        MessageGroupId: "test-group",
        MessageDeduplicationId: randomUUID(),
      };

      const result = await sqs.send(new SendMessageCommand(params));

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(result).toBeDefined();
    });
  });
});
