import type { IncomingEvent, IncomingRequest, IncomingResponse } from "@nestjs/microservices";

/** Nest RPC packet received on the SQS server (request-style microservice call). */
export type SqsServerRpcPacket = IncomingRequest;

/** Nest event packet received on the SQS server (`emit` / no correlation id in body). */
export type SqsServerEventPacket = IncomingEvent;

/** Any inbound Nest-shaped body on the server consumer. */
export type SqsServerInboundPacket = SqsServerRpcPacket | SqsServerEventPacket;

/** Reply packet received on the SQS client consumer (response to `send`). */
export type SqsClientInboundPacket = IncomingResponse;

export function isSqsServerRpcPacket(packet: SqsServerInboundPacket): packet is SqsServerRpcPacket {
  return typeof (packet as IncomingRequest).id === "string";
}

export function assertSqsMessageBody(body: string | undefined): asserts body is string {
  if (body == null || body === "") {
    throw new Error("SQS message Body is missing or empty");
  }
}
