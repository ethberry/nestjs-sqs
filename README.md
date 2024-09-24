# NestJS SQS

Tested with: [AWS SQS](https://aws.amazon.com/en/sqs/) and [ElasticMQ](https://github.com/softwaremill/elasticmq).

NestJS SQS is a project to make SQS easier to use and control some required flows with NestJS. This module provides
decorator-based message handling suited for simple use.

This library internally relies on [bbc/sqs-producer](https://github.com/bbc/sqs-producer)
and [bbc/sqs-consumer](https://github.com/bbc/sqs-consumer), and implements some more useful features on top of the
basic functionality given by them.

## Installation

```shell script
$ npm i --save @gemunion/nestjs-sqs
```

## Quick Start

### Register custom transport

Just like you register any other microservice

```ts
import { SQSClient } from "@aws-sdk/client-sqs";
import { SqsServer } from "@gemunion/nestjs-sqs";

const sqs = new SQSClient({
  endpoint: "http://localhost:9324",
  region: "none",
  credentials: {
    accessKeyId: "x",
    secretAccessKey: "x",
  },
});

app.connectMicroservice({
  strategy: new SqsServer({
    consumerOptions: {
      sqs,
      queueUrl: "http://localhost:9324/queue/producer.fifo",
    },
    producerOptions: {
      sqs,
      queueUrl: "http://localhost:9324/queue/consumer.fifo",
    },
  }),
});
```

### Decorate methods

You need to decorate methods in your NestJS controller in order to have them be automatically attached as event handlers
for incoming SQS messages:

```ts
@Controller()
export class SqsController {
  @MessagePattern(MESSAGE_TYPE)
  public handleMessage(message: any): Promise<any> {
    // do something, return result
  }

  @EventPattern(EVENT_TYPE)
  public handleEvent(event: any): Promise<void> {
    // do something
  }
}
```

### Produce messages

```ts
import { SQSClient } from "@aws-sdk/client-sqs";
import { SqsClient, SQS_SERVICE } from "@gemunion/nestjs-sqs";

const sqs = new SQSClient({
  endpoint: "http://localhost:9324",
  region: "none",
  credentials: {
    accessKeyId: "x",
    secretAccessKey: "x",
  },
});

@Module({
  imports: [
    ClientsModule.register([
      {
        name: SQS_SERVICE,
        customClass: SqsClient,
        options: {
          consumerUrl: "http://localhost:9324/queue/consumer.fifo",
          producerUrl: "http://localhost:9324/queue/producer.fifo",
          sqs,
        },
      },
    ]),
  ],
  providers: [AppService],
})
class AppModule {}

export class AppService {
  constructor(
    @Inject(SQS_SERVICE)
    private readonly sqsClientProxy: ClientProxy,
  ) {}

  public dispatch(): Promise<void> {
    void this.client.emit(EVENT_NAME, {});
  }
}
```

### Code quality

```sh
docker compose up -d
npm t
```

## License

This project is licensed under the terms of the MIT license.
