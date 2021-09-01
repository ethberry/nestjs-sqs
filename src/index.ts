import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Credentials, SQS } from "aws-sdk";

import { AppModule } from "./app.module";
import { SqsServer } from "./sqs/server/sqs.server";
import { TestQueue } from "./sqs/interfaces";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  app.connectMicroservice({
    strategy: new SqsServer({
      queueUrl: "http://localhost:9324/queue/test.fifo",
      sqs: new SQS({
        apiVersion: "2012-11-05",
        credentials: new Credentials("x", "x"),
        region: "none",
      }),
    }),
  });

  await app.startAllMicroservices().then(() => {
    console.info(`Sqs Listener is listening to ${TestQueue.Test}`);
  });

  const host = configService.get<string>("HOST", "localhost");
  const port = configService.get<number>("PORT", 3000);

  await app.listen(port, host, () => {
    console.info(`API server is running on http://${host}:${port}`);
  });
}

void bootstrap();
