import { Serializer } from "@nestjs/microservices";

export class SqsSerializer implements Serializer {
  serialize(value: any): any {
    const message = value.data;
    let body = message.body;

    if (typeof body !== "string") {
      body = JSON.stringify(body);
    }

    return {
      ...message,
      body,
    };
  }
}
