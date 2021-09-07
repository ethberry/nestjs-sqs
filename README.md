# nestjs-sqs

[![Test](https://github.com/gemunion/nestjs-sqs/workflows/Test/badge.svg)](https://github.com/gemunion/nestjs-sqs/actions?query=workflow%3ATest)
[![npm version](https://badge.fury.io/js/%40gemunion%2Fnestjs-sqs.svg)](https://badge.fury.io/js/%40gemunion%2Fnestjs-sqs)

Tested with: [AWS SQS](https://aws.amazon.com/en/sqs/) and [ElasticMQ](https://github.com/softwaremill/elasticmq).

Nestjs-sqs is a project to make SQS easier to use and control some required flows with NestJS.
This module provides decorator-based message handling suited for simple use.

This library internally uses [bbc/sqs-producer](https://github.com/bbc/sqs-producer) and [bbc/sqs-consumer](https://github.com/bbc/sqs-consumer), and implements some more useful features on top of the basic functionality given by them.

## Installation

```shell script
$ npm i --save @gemunion/nestjs-sqs
```

## Quick Start

### Register custom transport

Just like you register any other microservice

```ts
app.connectMicroservice({
  strategy: new SqsServer({
    consumerUrl: "http://localhost:9324/queue/producer.fifo",
    producerUrl: "http://localhost:9324/queue/consumer.fifo",
    sqs: new SQS({
      apiVersion: "2012-11-05",
      credentials: new Credentials("x", "x"),
      region: "none",
    }),
  }),
});
```

### Decorate methods

You need to decorate methods in your NestJS providers in order to have them be automatically attached as event handlers for incoming SQS messages:

```ts
@Controller()
export class SqsController {
  @MessagePattern(MESSAGE_TYPE)
  public handleMessage(message: any): Promise<any> {
    // do something, return result
  }

  @EventPattern(EVENT_TYPE)
  public handleEvent(error: Error, message: SQS.Message): Promise<void> {
    // do something
  }
}
```

### Produce messages

```ts
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

Terminal 1
```sh
java -Dconfig.file=.github/build/elasticmq.conf -jar elasticmq-server-1.2.0.jar
```

Terminal 2
```sh
npm t
```

## License

This project is licensed under the terms of the MIT license.
