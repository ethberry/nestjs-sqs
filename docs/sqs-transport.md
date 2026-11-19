# SQS transport

`@ethberry/nestjs-sqs`: a NestJS microservice transport over Amazon SQS (and SQS-compatible ElasticMQ / LocalStack). `SqsServer` is a custom transport strategy for `app.connectMicroservice`, `SqsClient` is a `ClientProxy`; handlers use the usual `@MessagePattern` / `@EventPattern`, `@Payload()`, `@Ctx()`. Sending goes through `sqs-producer`, receiving through `sqs-consumer` (long polling). Consumer usage and full examples are in the package `README.md`.

## Queues and flow

Two queues per pair:

- **Inbound** (the server's `consumerOptions.queueUrl` = the client's `producerUrl`): requests and events.
- **Reply** (the server's `producerOptions.queueUrl` = the client's `consumerUrl`): RPC replies.

1. `client.emit(pattern, data)` (event) or `client.send(pattern, data)` (RPC) serializes `{ pattern, data, id? }` into the message `Body` (JSON). An RPC packet gets a random correlation `id`; an event has none.
2. `SqsServer` polls the inbound queue, deserializes the `Body` and builds an `SqsContext` (`[message, queueUrl, pattern]`; `getMessage()`, `getQueueUrl()`, `getPattern()` give the raw SQS message with attributes and receipt handle). A non-string pattern is matched by its `JSON.stringify`.
3. Event: the handler runs; the message is returned to `sqs-consumer`, which deletes it. An event with no handler is logged (`NO_EVENT_HANDLER`) and **deleted** too, so an undeliverable event is not redelivered forever.
4. RPC: the handler's result (value, promise or observable) is sent to the reply queue as **one** message `{ id, response, isDisposed: true }`; `undefined` is sent as `null` (Nest's client needs `response` and `isDisposed` in one packet). An error becomes `{ id, err }`. An RPC with no handler gets an error reply with the request's `id` (`NO_MESSAGE_HANDLER`, `status: "error"`), so the client's call rejects at once instead of waiting for its timeout.
5. `SqsClient` polls the reply queue, deserializes `{ id, response, err, status, isDisposed }` and resolves the pending call by `id`.

## Options

- `SqsServer({ consumerOptions, producerOptions, serializer?, deserializer? })`: `consumerOptions` / `producerOptions` go to `sqs-consumer` / `sqs-producer` as they are (queue URL, `sqs` client, batch size, `pollingCompleteWaitTimeMs`, …).
- `SqsClient({ producerUrl, consumerUrl, region?, sqs?, batchSize?, serializer?, deserializer? })`: `sqs` is a shared AWS SDK v3 `SQSClient` for both directions.
- Serializers: `SqsSerializer` (default, standard queues) and `SqsFifoSerializer` (FIFO queues: adds `groupId` `"nestjs"` and `deduplicationId` = the packet id). Bodies are the same JSON for both; FIFO metadata lives on the SQS message, not in `Body`. `SqsDeserializer` parses the JSON `Body` for both sides.

## Semantics and limits

- At-least-once delivery: a handler can see the same message twice; handlers must be idempotent.
- Ordering: best-effort on standard queues, per message group on FIFO (all messages share the group `"nestjs"` with `SqsFifoSerializer`).
- Visibility timeout, dead-letter queues and throttling are SQS settings of the queues, not of this package.
- `close({ abort? })` stops the consumer; for a graceful stop set `pollingCompleteWaitTimeMs` so in-flight handlers finish. `on(...)` (status events) is not supported and throws.
- `unwrap()` returns `[consumer, producer]`; on the client it throws before `connect()` / `startAllMicroservices`.

## Tests

- Unit (`*.unit.spec.ts`, `npm run test:unit`): serializers, deserializer, packet guards, `SqsContext`.
- Integration (`*.integration.spec.ts`, `npm run test:integration`): a real server and client against ElasticMQ and LocalStack started with `npm run docker:sqs:up`; endpoints from `ELASTICMQ_URL` / `LOCALSTACK_URL` in `.env`.
