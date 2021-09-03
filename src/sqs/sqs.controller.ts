import { Controller, Get } from "@nestjs/common";
import { MessagePattern } from "@nestjs/microservices";

import { SqsService } from "./sqs.service";

@Controller("/sqs")
export class SqsController {
  constructor(private readonly sqsService: SqsService) {}

  @MessagePattern("TEST")
  public receive<T = any>(data: T): Promise<T> {
    return this.sqsService.receive(data);
  }

  @Get("/emit")
  public emit(): Promise<any> {
    return this.sqsService.emit();
  }

  @Get("/send")
  public send(): Promise<any> {
    return this.sqsService.send();
  }
}
