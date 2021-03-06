import { HttpServer } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common/enums/request-method.enum';
import { Controller } from '@nestjs/common/interfaces/controllers/controller.interface';
import { Type } from '@nestjs/common/interfaces/type.interface';
import { ApplicationConfig } from '../application-config';
import { NestContainer } from '../injector/container';
import { Injector } from '../injector/injector';
import { InstanceWrapper } from '../injector/instance-wrapper';
import { Module } from '../injector/module';
import { MetadataScanner } from '../metadata-scanner';
import { ExceptionsFilter } from './interfaces/exceptions-filter.interface';
import { RouterProxy, RouterProxyCallback } from './router-proxy';
export interface RoutePathProperties {
    path: string[];
    requestMethod: RequestMethod;
    targetCallback: RouterProxyCallback;
    methodName: string;
}
export declare class RouterExplorer {
    private readonly metadataScanner;
    private readonly container;
    private readonly injector?;
    private readonly routerProxy?;
    private readonly exceptionsFilter?;
    private readonly executionContextCreator;
    private readonly routerMethodFactory;
    private readonly logger;
    private readonly exceptionFiltersCache;
    constructor(metadataScanner: MetadataScanner, container: NestContainer, injector?: Injector, routerProxy?: RouterProxy, exceptionsFilter?: ExceptionsFilter, config?: ApplicationConfig);
    explore<T extends HttpServer = any>(instanceWrapper: InstanceWrapper, module: string, applicationRef: T, basePath: string, host: string): void;
    extractRouterPath(metatype: Type<Controller>, prefix?: string): string;
    validateRoutePath(path: string): string;
    scanForPaths(instance: Controller, prototype?: object): RoutePathProperties[];
    exploreMethodMetadata(instance: Controller, prototype: object, methodName: string): RoutePathProperties;
    applyPathsToRouterProxy<T extends HttpServer>(router: T, routePaths: RoutePathProperties[], instanceWrapper: InstanceWrapper, moduleKey: string, basePath: string, host: string): void;
    stripEndSlash(str: string): string;
    private applyCallbackToRouter;
    private applyHostFilter;
    private createCallbackProxy;
    createRequestScopedHandler(instanceWrapper: InstanceWrapper, requestMethod: RequestMethod, moduleRef: Module, moduleKey: string, methodName: string): <TRequest extends Record<any, any>, TResponse>(req: TRequest, res: TResponse, next: () => void) => Promise<void>;
    private getContextId;
}
