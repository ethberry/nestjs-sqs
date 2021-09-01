import { Observable } from "rxjs";
import { Controller, Get } from "@nestjs/common";
import { MessagePattern } from "@nestjs/microservices";

import { SqsService } from "./sqs.service";

@Controller("/sqs")
export class SqsController {
  constructor(private readonly sqsService: SqsService) {}

  @MessagePattern("BLOCK")
  public block(data: any): Observable<any> {
    return this.sqsService.block(data);
  }

  @MessagePattern("TRANSACTION")
  public transaction(data: any): Observable<any> {
    return this.sqsService.transaction(data);
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
