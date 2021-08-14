# nestjs-sqs

[![Test](https://github.com/gemunionstudio/nestjs-sqs/workflows/Test/badge.svg)](https://github.com/gemunionstudio/nestjs-sqs/actions?query=workflow%3ATest)
[![npm version](https://badge.fury.io/js/%40gemunionstudio%2Fnestjs-sqs.svg)](https://badge.fury.io/js/%40gemunionstudio%2Fnestjs-sqs)

Tested with: [AWS SQS](https://aws.amazon.com/en/sqs/) and [ElasticMQ](https://github.com/softwaremill/elasticmq).

Nestjs-sqs is a project to make SQS easier to use and control some required flows with NestJS.
This module provides decorator-based message handling suited for simple use.

This library internally uses [bbc/sqs-producer](https://github.com/bbc/sqs-producer) and [bbc/sqs-consumer](https://github.com/bbc/sqs-consumer), and implements some more useful features on top of the basic functionality given by them.

## Installation

```shell script
$ npm i --save @gemunionstudio/nestjs-sqs
```

## Quick Start

### Register module

Just register this module:

```ts
@Module({
  imports: [
    SqsModule.forRoot({
      consumers: [],
      producers: [],
    }),
  ],
})
class AppModule {}
```

Quite often you might want to asynchronously pass module options instead of passing them beforehand.
In such case, use `registerAsync()` method like many other Nest.js libraries.

- Use factory

```ts
SqsModule.forRootAsync({
  useFactory: () => {
    return {
      consumers: [],
      producers: [],
    };
  },
});
```

- Use class

```ts
SqsModule.forRootAsync({
  useClass: SqsConfigService,
});
```

- Use existing

```ts
SqsModule.forRootAsync({
  imports: [ConfigModule],
  useExisting: ConfigService,
});
```

### Decorate methods

You need to decorate methods in your NestJS providers in order to have them be automatically attached as event handlers for incoming SQS messages:

```ts
@Injectable()
export class AppMessageHandler {
  @SqsMessageHandler(/** name: */ 'queueName', /** batch: */ false)
  public async handleMessage(message: SQS.Message) {
  }

  @SqsConsumerEventHandler(/** name: */ 'queueName', /** eventName: */ 'processing_error')
  public onProcessingError(error: Error, message: SQS.Message) {
    // report errors here
  }
}
```

### Produce messages

```ts
export class AppService {
  public constructor(
    private readonly sqsService: SqsService,
  ) { }

  public async dispatchSomething() {
    await this.sqsService.send(/** name: */ 'queueName', {
      id: 'id',
      body: { ... },
      groupId: 'groupId',
      deduplicationId: 'deduplicationId',
      messageAttributes: { ... },
      delaySeconds: 0,
    });
  }
}
```

### Configuration

See [here](https://github.com/gemunionstudio/nestjs-sqs/blob/master/lib/sqs.types.ts), and note that we have same configuration as
[bbc/sqs-producer's](https://github.com/bbc/sqs-producer) and [bbc/sqs-consumer's](https://github.com/bbc/sqs-consumer).
In most time you just need to specify both `name` and `queueUrl` at the minimum requirements.

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
