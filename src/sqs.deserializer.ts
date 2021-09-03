import { Deserializer } from "@nestjs/microservices";

export class SqsDeserializer implements Deserializer {
  deserialize(value: any): any {
    return JSON.parse(value.Body);
  }
}
