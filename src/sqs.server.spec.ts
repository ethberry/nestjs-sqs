import { Controller, INestApplication, Inject, Injectable, Module } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ClientProxy, ClientsModule, MessagePattern } from "@nestjs/microservices";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { firstValueFrom } from "rxjs";
import { v4 } from "uuid";

import { SqsServer } from "./sqs.server";
import { SqsClient } from "./sqs.client";

const AWS_REGION = "eu-west-1";
const SQS_SERVICE = "SQS_SERVICE";
const EVENT_NAME = "EVENT_NAME";
const NON_EXISTING_EVENT_NAME = "NON_EXISTING_EVENT_NAME";

const consumerUrl = "http://localhost:9324/queue/producer.fifo";
const producerUrl = "http://localhost:9324/queue/consumer.fifo";

const sqs = new SQSClient({
  endpoint: "http://localhost:9324",
  region: AWS_REGION,
  credentials: {
    accessKeyId: "x",
    secretAccessKey: "x",
  },
});

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

@Module({
  imports: [
    ClientsModule.register([
      {
        name: SQS_SERVICE,
        customClass: SqsClient,
        options: {
          consumerUrl: producerUrl,
          producerUrl: consumerUrl,
          sqs,
        },
      },
    ]),
  ],
  controllers: [SqsController],
  providers: [SqsService],
})
class SqsModule {}

describe("SqsServer", () => {
  let app: INestApplication;
  let sqsService: SqsService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [SqsModule],
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

    sqsService = module.get<SqsService>(SqsService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should be defined", () => {
    expect(app).toBeDefined();
  });

  describe("SqsService", () => {
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
      logSpy = jest.spyOn(sqsService, "receive");
    });

    afterEach(() => {
      logSpy.mockClear();
    });

    it("should emit event", async () => {
      const data = { test: true };
      const result = await sqsService.emit(data);

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(result).toHaveLength(1);
      expect(logSpy).toBeCalledTimes(1);
    });

    it("should receive event", async () => {
      const data = { test: true };
      const params = {
        // DelaySeconds: 10,
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
        MessageGroupId: "test",
        MessageDeduplicationId: v4(),
        QueueUrl: consumerUrl,
      };
      const result = await sqs.send(new SendMessageCommand(params));

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(result).toBeDefined();
      expect(logSpy).toBeCalledTimes(1);
    });

    it("should send/receive event", async () => {
      const data = { test: true };
      const result = await sqsService.send(data);

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(result).toEqual(data);
      expect(logSpy).toBeCalledTimes(1);
    });

    it("should handle absent handler", async () => {
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
        MessageGroupId: "test",
        MessageDeduplicationId: v4(),
        QueueUrl: consumerUrl,
      };

      const result = await sqs.send(new SendMessageCommand(params));

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(result).toBeDefined();
    });
  });
});
