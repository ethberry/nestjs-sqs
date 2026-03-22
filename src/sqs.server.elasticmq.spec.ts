import { randomUUID } from "node:crypto";

import { Controller, INestApplication, Inject, Injectable, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { ClientProxy, ClientsModule, MessagePattern } from "@nestjs/microservices";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { firstValueFrom } from "rxjs";

import { SqsFifoSerializer } from "./serializers";
import { SqsServer } from "./sqs.server";
import { SqsClient } from "./sqs.client";

const AWS_REGION = "elasticmq";
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

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(result).toHaveLength(1);
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should receive event (ElasticMQ, standard)", async () => {
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

    it("should send/receive event (ElasticMQ, standard)", async () => {
      const data = { test: true };
      const result = await sqsService.send(data);

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(result).toEqual(data);
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle absent handler (ElasticMQ, standard)", async () => {
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

    beforeEach(() => {
      logSpy = jest.spyOn(sqsService, "receive");
    });

    afterEach(() => {
      logSpy.mockClear();
    });

    it("should emit event (ElasticMQ, FIFO)", async () => {
      const data = { test: true };
      const result = await sqsService.emit(data);

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(result).toHaveLength(1);
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should receive event (ElasticMQ, FIFO)", async () => {
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

    it("should send/receive event (ElasticMQ, FIFO)", async () => {
      const data = { test: true };
      const result = await sqsService.send(data);

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(result).toEqual(data);
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle absent handler (ElasticMQ, FIFO)", async () => {
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
