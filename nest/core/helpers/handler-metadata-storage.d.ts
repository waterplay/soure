import { Type } from '@nestjs/common';
import { ContextId } from '../injector/instance-wrapper';
import { ParamProperties } from './context-utils';
export declare const HANDLER_METADATA_SYMBOL: unique symbol;
export interface HandlerMetadata {
    argsLength: number;
    paramtypes: any[];
    httpStatusCode: number;
    responseHeaders: any[];
    hasCustomHeaders: boolean;
    getParamsMetadata: (moduleKey: string, contextId?: ContextId, inquirerId?: string) => (ParamProperties & {
        metatype?: any;
    })[];
    fnHandleResponse: <TResult, TResponse>(result: TResult, res: TResponse) => any;
}
export declare class HandlerMetadataStorage<TValue = HandlerMetadata, TKey extends Type<unknown> = any> {
    private readonly [HANDLER_METADATA_SYMBOL];
    set(controller: TKey, methodName: string, metadata: TValue): void;
    get(controller: TKey, methodName: string): TValue | undefined;
    private getMetadataKey;
}
