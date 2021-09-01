import { Observable, firstValueFrom } from "rxjs";
import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";

import { ProviderType } from "../common/providers";
import { IMessage } from "./interfaces";

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
    const id = Math.floor(Math.random() * 1000000).toString();

    const res = this.ethClientProxy.emit<string, IMessage>("KEY", {
      id,
      body: { test: true },
      delaySeconds: 0,
      groupId: "test",
      deduplicationId: id,
    });

    return firstValueFrom(res);
  }

  public send(): Promise<any> {
    const id = Math.floor(Math.random() * 1000000).toString();

    const res = this.ethClientProxy.send<string, IMessage>("KEY", {
      id,
      body: { test: true },
      delaySeconds: 0,
      groupId: "test",
      deduplicationId: id,
    });

    return firstValueFrom(res);
  }
}
