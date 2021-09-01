import { ClientProxy, ClientProxyFactory } from "@nestjs/microservices";

import { ProviderType } from "../common/providers";
import { Credentials, SQS } from "aws-sdk";
import { SqsClient } from "./server/sqs.client";

export const sqsServiceProvider = {
  provide: ProviderType.SQS_SERVICE,
  useFactory: (): ClientProxy => {
    return ClientProxyFactory.create({
      customClass: SqsClient,
      options: {
        queueUrl: "http://localhost:9324/queue/test.fifo",
        sqs: new SQS({
          apiVersion: "2012-11-05",
          credentials: new Credentials("x", "x"),
          region: "none",
        }),
      },
    });
  },
};
