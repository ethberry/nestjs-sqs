import { Controller, INestApplication, Inject, Module } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ClientProxy, ClientsModule, MessagePattern } from "@nestjs/microservices";
import { Credentials, SQS } from "aws-sdk";
import { firstValueFrom } from "rxjs";

import { SqsServer } from "./sqs.server";
import { SqsClient } from "./sqs.client";

const sqs = new SQS({
  apiVersion: "2012-11-05",
  credentials: new Credentials("x", "x"),
  region: "none",
});

const consumerUrl = "http://localhost:9324/queue/producer.fifo";
const producerUrl = "http://localhost:9324/queue/consumer.fifo";

const SQS_SERVICE = "SQS_SERVICE";
const EVENT_NAME = "EVENT_NAME";

@Controller()
class SqsController {
  constructor(
    @Inject(SQS_SERVICE)
    private readonly sqsClientProxy: ClientProxy,
  ) {}

  @MessagePattern(EVENT_NAME)
  public receive<T = any>(data: T): Promise<T> {
    return Promise.resolve(data);
  }

  public emit(data: any): Promise<any> {
    const res = this.sqsClientProxy.emit<string, any>(EVENT_NAME, data);
    return firstValueFrom(res);
  }

  public send(data: any): Promise<any> {
    const res = this.sqsClientProxy.send<string, any>(EVENT_NAME, data);
    return firstValueFrom(res);
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
})
class SqsModule {}

describe("SqsServer", () => {
  let app: INestApplication;
  let sqsController: SqsController;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [SqsModule],
    }).compile();
    app = module.createNestApplication();
    app.connectMicroservice({
      strategy: new SqsServer({
        consumerUrl,
        producerUrl,
        sqs,
      }),
    });
    await app.startAllMicroservices();

    sqsController = module.get<SqsController>(SqsController);
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
      logSpy = jest.spyOn(sqsController, "send");
    });

    afterEach(() => {
      logSpy.mockClear();
    });

    it("should send/receive event", async () => {
      const data = { test: true };
      const result = await sqsController.send(data);

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(result).toEqual(data);
      expect(logSpy).toBeCalledTimes(1);
    });
  });
});
