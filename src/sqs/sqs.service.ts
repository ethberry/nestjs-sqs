import { Observable, firstValueFrom } from "rxjs";
import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";

import { ProviderType } from "../common/providers";

@Injectable()
export class SqsService {
  constructor(
    @Inject(ProviderType.SQS_SERVICE)
    private readonly ethClientProxy: ClientProxy,
  ) {}

  public block(block: any): Observable<any> {
    return this.ethClientProxy.emit("BLOCK", block);
  }

  public transaction(transaction: any): Observable<any> {
    return this.ethClientProxy.emit("TRANSACTION", transaction);
  }

  public emit(): Promise<any> {
    const res = this.ethClientProxy.emit<string, any>("KEY", { test: true });

    return firstValueFrom(res);
  }

  public send(): Promise<any> {
    const res = this.ethClientProxy.send<string, any>("KEY", { test: true });

    return firstValueFrom(res);
  }
}
