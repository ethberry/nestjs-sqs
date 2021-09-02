import { Deserializer } from "@nestjs/microservices";

export class SqsDeserializer implements Deserializer {
  deserialize(value: any): any {
    const data = JSON.parse(value.Body);
    return {
      id: data.id,
      response: data.data,
    };
  }
}
