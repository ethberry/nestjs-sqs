# NestJS SQS

Tested with [AWS SQS](https://aws.amazon.com/en/sqs/), [ElasticMQ](https://github.com/softwaremill/elasticmq), and [LocalStack](https://localstack.cloud/) (see integration tests in this repo).

NestJS SQS is a project to make SQS easier to use and control some required flows with NestJS. This module provides
decorator-based message handling suited for simple use.

This library internally relies on [bbc/sqs-producer](https://github.com/bbc/sqs-producer)
and [bbc/sqs-consumer](https://github.com/bbc/sqs-consumer), and implements some more useful features on top of the
basic functionality given by them.

The default **`SqsSerializer`** and **`SqsDeserializer`** work for standard queues. Message **bodies** are the same JSON for FIFO; FIFO metadata is on the SQS message, not in `Body`, so only the **serializer** changes for FIFO: register **`SqsFifoSerializer`** via the `serializer` option on `SqsClient` / `SqsServer` when needed (all are exported from this package).

## Compared to Redis and RabbitMQ transports

Nest’s **Redis** and **RMQ** servers are first-party: multiplexed connections, push-style delivery, and rich metadata on the broker record. **SQS** is different by design:

| Topic | Redis / RMQ (typical) | This SQS transport |
|--------|------------------------|---------------------|
| Delivery | Often push / subscription | **Long polling** (`sqs-consumer`) |
| Semantics | Depends on broker | **At-least-once**; duplicates possible |
| Request–reply | Channels / reply-to | **Two queues** + correlation **`id`** in the JSON body |
| Ordering | Broker-specific | **Standard** = best-effort; **FIFO** = per message group (see AWS docs) |
| Metadata | Headers / properties | **`Body`** holds the Nest packet by default; use **`SqsContext`** for raw `Message` (attributes, receipt handle, etc.) |

The Nest **API** stays familiar: `@MessagePattern` / `@EventPattern`, `ClientProxy`, and serializers—but **operational behavior** follows SQS (visibility timeout, DLQ, throttling). Plan retries and idempotency accordingly.

## Requirements

- **Node.js 24+** (will run on 22, but not tested)

## Installation

```shell script
$ npm i --save @ethberry/nestjs-sqs
```

## Local integration tests

Integration specs read **`ELASTICMQ_URL`** and **`LOCALSTACK_URL`** from a **`.env`** file at the repo root (committed defaults). Start ElasticMQ and LocalStack, then run tests:

```shell script
$ npm i
$ npm run docker:sqs:up
$ npm test
$ npm run docker:sqs:down
```

Override endpoints by editing `.env` (for example different ports).

To match CI (lint + tests) after dependencies and Docker are up:

```shell script
$ npm run lint && npm test
```

## Quick Start

### Register custom transport

Just like you register any other microservice

```ts
import { SQSClient } from "@aws-sdk/client-sqs";
import { SqsServer } from "@ethberry/nestjs-sqs";

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
      queueUrl: "http://localhost:9324/queue/producer",
    },
    producerOptions: {
      sqs,
      queueUrl: "http://localhost:9324/queue/consumer",
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

### Handler context (`SqsContext`)

Like **`RmqContext`** or **`RedisContext`**, you can inject **`SqsContext`** with `@Ctx()` to read the raw AWS **`Message`**, the consumer **queue URL**, and the **pattern** string. The first argument remains the deserialized **payload** (`data` from the body).

```ts
import { Controller } from "@nestjs/common";
import { Ctx, MessagePattern, Payload } from "@nestjs/microservices";
import { SqsContext } from "@ethberry/nestjs-sqs";

@Controller()
export class SqsController {
  @MessagePattern(MESSAGE_TYPE)
  public handleRpc(@Payload() data: unknown, @Ctx() ctx: SqsContext): Promise<unknown> {
    const sqs = ctx.getMessage();
    const attrs = sqs.MessageAttributes;
    // ...
    return { ok: true };
  }
}
```

Events emitted without a top-level **`id`** in the packet are routed with **`@EventPattern`** (same idea as other Nest transports).

### Graceful shutdown

[`sqs-consumer`](https://github.com/bbc/sqs-consumer) can wait for the last poll and in-flight **`handleMessage`** work before stopping. Set **`pollingCompleteWaitTimeMs`** on **`consumerOptions`** (milliseconds you are willing to wait). **`SqsServer.close()`** forwards optional **`StopOptions`** to **`consumer.stop()`** (for example `{ abort: true }` to cancel in-flight polls—use sparingly).

```ts
new SqsServer({
  consumerOptions: {
    sqs,
    queueUrl: "...",
    pollingCompleteWaitTimeMs: 10_000,
  },
  producerOptions: { sqs, queueUrl: "..." },
});
```

When the app stops, call **`app.close()`** (or otherwise invoke the microservice **`close`**) so the consumer shuts down.

### Produce messages

```ts
import { SQSClient } from "@aws-sdk/client-sqs";
import { SqsClient, SQS_SERVICE } from "@ethberry/nestjs-sqs";

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
          consumerUrl: "http://localhost:9324/queue/consumer",
          producerUrl: "http://localhost:9324/queue/producer",
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
    void this.sqsClientProxy.emit(EVENT_NAME, {});
  }
}
```

## License

This project is licensed under the terms of the MIT license.
