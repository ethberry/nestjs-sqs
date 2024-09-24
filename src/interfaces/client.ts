import type { Type } from "@nestjs/common";
import type { ClientProxy, Deserializer, Serializer } from "@nestjs/microservices";
import { SQSClient } from "@aws-sdk/client-sqs";

export interface ISqsClientOptions {
  customClass: Type<ClientProxy>;
  options: {
    producerUrl: string;
    consumerUrl: string;
    region?: string;
    sqs?: SQSClient;
    batchSize?: number;
    serializer?: Serializer;
    deserializer?: Deserializer;
  };
}
