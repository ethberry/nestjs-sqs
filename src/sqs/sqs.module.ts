import { Logger, Module } from "@nestjs/common";

import { SqsService } from "./sqs.service";
import { SqsController } from "./sqs.controller";
import { sqsServiceProvider } from "./sqs.provider";

@Module({
  providers: [sqsServiceProvider, Logger, SqsService],
  controllers: [SqsController],
  exports: [SqsService],
})
export class SqsModule {}
