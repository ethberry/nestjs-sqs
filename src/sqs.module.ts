import { DynamicModule, Global, Module, Provider, Type } from "@nestjs/common";
import { SqsService } from "./sqs.service";
import { ISqsModuleAsyncOptions, ISqsModuleOptionsFactory, ISqsOptions } from "./sqs.types";
import { SQS_OPTIONS } from "./sqs.constants";
import { DiscoveryModule, DiscoveryService } from "@nestjs-plus/discovery";

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [SqsService],
  exports: [SqsService],
})
export class SqsModule {
  public static register(options: ISqsOptions): DynamicModule {
    const sqsOptions: Provider = {
      provide: SQS_OPTIONS,
      useValue: options,
    };
    const sqsProvider: Provider = {
      provide: SqsService,
      useFactory: (sqsOptions: ISqsOptions, discover: DiscoveryService) => new SqsService(options, discover),
      inject: [SQS_OPTIONS, DiscoveryService],
    };

    return {
      global: true,
      module: SqsModule,
      imports: [DiscoveryModule],
      providers: [sqsOptions, sqsProvider],
      exports: [sqsProvider],
    };
  }

  public static registerAsync(options: ISqsModuleAsyncOptions): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options);
    const sqsProvider: Provider = {
      provide: SqsService,
      useFactory: (options: ISqsOptions, discover: DiscoveryService) => new SqsService(options, discover),
      inject: [SQS_OPTIONS, DiscoveryService],
    };

    return {
      global: true,
      module: SqsModule,
      imports: [DiscoveryModule, ...(options.imports ?? [])],
      providers: [...asyncProviders, sqsProvider],
      exports: [sqsProvider],
    };
  }

  private static createAsyncProviders(options: ISqsModuleAsyncOptions): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }
    const useClass = options.useClass as Type<ISqsModuleOptionsFactory>;
    return [
      this.createAsyncOptionsProvider(options),
      {
        provide: useClass,
        useClass,
      },
    ];
  }

  private static createAsyncOptionsProvider(options: ISqsModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: SQS_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    const inject = [(options.useClass || options.useExisting) as Type<ISqsModuleOptionsFactory>];
    return {
      provide: SQS_OPTIONS,
      useFactory: async (optionsFactory: ISqsModuleOptionsFactory) => await optionsFactory.createOptions(),
      inject,
    };
  }
}
