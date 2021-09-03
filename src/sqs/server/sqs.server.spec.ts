import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Credentials, SQS } from "aws-sdk";
import { Producer } from "sqs-producer";
import { v4 } from "uuid";

import { SqsServer } from "./sqs.server";
import { TestQueue } from "../interfaces";
import { SqsModule } from "../sqs.module";
import { SqsService } from "../sqs.service";

describe("SqsServer", () => {
  let app: INestApplication;
  let sqsService: SqsService;

  const sqs = new SQS({
    apiVersion: "2012-11-05",
    credentials: new Credentials("x", "x"),
    region: "none",
  });

  const consumerUrl = "http://localhost:9324/queue/producer.fifo";
  const producerUrl = "http://localhost:9324/queue/consumer.fifo";

  const producer = Producer.create({
    queueUrl: consumerUrl,
    sqs,
  });

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
    await app.startAllMicroservices().then(() => {
      console.info(`Sqs Listener is listening to ${TestQueue.Test}`);
    });
    await app.listen(0);

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

    it("should receive event", async () => {
      const uuid = v4();
      await producer.send({
        id: uuid,
        body: JSON.stringify({
          pattern: "TEST",
          data: {
            test: true,
          },
          id: uuid,
        }),
        delaySeconds: 0,
        groupId: "test",
        deduplicationId: uuid,
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(logSpy).toBeCalledTimes(1);
    });
  });
});
