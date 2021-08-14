import { DynamicModule, Module } from "@nestjs/common";
import { DiscoveryModule } from "@golevelup/nestjs-discovery";

import { createConfigurableDynamicRootModule } from "@golevelup/nestjs-modules";

import { SQS_OPTIONS } from "./sqs.constants";
import { SqsService } from "./sqs.service";
import type { ISqsOptions } from "./interfaces";

@Module({
  imports: [DiscoveryModule],
  providers: [SqsService],
  exports: [SqsService],
})
export class SqsModule extends createConfigurableDynamicRootModule<SqsModule, ISqsOptions>(SQS_OPTIONS) {
  static deferred = (): Promise<DynamicModule> => SqsModule.externallyConfigured(SqsModule, 0);
}
