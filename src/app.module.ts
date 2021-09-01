import { Logger, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { SqsModule } from "./sqs/sqs.module";

@Module({
  providers: [Logger],
  imports: [
    ConfigModule.forRoot({
      envFilePath: ".env.development",
    }),
    SqsModule,
  ],
})
export class AppModule {}
