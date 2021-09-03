import { firstValueFrom } from "rxjs";
import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";

import { ProviderType } from "../common/providers";

@Injectable()
export class SqsService {
  constructor(
    @Inject(ProviderType.SQS_SERVICE)
    private readonly sqsClientProxy: ClientProxy,
  ) {}

  public receive<T = any>(data: T): Promise<T> {
    return Promise.resolve(data);
  }

  public emit(): Promise<any> {
    const res = this.sqsClientProxy.emit<string, any>("TEST", { test: true });

    return firstValueFrom(res);
  }

  public send(): Promise<any> {
    const res = this.sqsClientProxy.send<string, any>("TEST", { test: true });

    return firstValueFrom(res);
  }
}
