import { CanActivate, ExceptionFilter, HttpServer, INestApplication, INestMicroservice, NestHybridApplicationOptions, NestInterceptor, PipeTransform, WebSocketAdapter } from '@nestjs/common';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { NestApplicationOptions } from '@nestjs/common/interfaces/nest-application-options.interface';
import { AbstractHttpAdapter } from './adapters';
import { ApplicationConfig } from './application-config';
import { NestContainer } from './injector/container';
import { NestApplicationContext } from './nest-application-context';
/**
 * @publicApi
 */
export declare class NestApplication extends NestApplicationContext implements INestApplication {
    private readonly httpAdapter;
    private readonly config;
    private readonly appOptions;
    private readonly logger;
    private readonly middlewareModule;
    private readonly middlewareContainer;
    private readonly microservicesModule;
    private readonly socketModule;
    private readonly routesResolver;
    private readonly microservices;
    private httpServer;
    private isListening;
    constructor(container: NestContainer, httpAdapter: HttpServer, config: ApplicationConfig, appOptions?: NestApplicationOptions);
    protected dispose(): Promise<void>;
    getHttpAdapter(): AbstractHttpAdapter;
    registerHttpServer(): void;
    getUnderlyingHttpServer<T>(): T;
    applyOptions(): void;
    createServer<T = any>(): T;
    registerModules(): Promise<void>;
    registerWsModule(): void;
    init(): Promise<this>;
    registerParserMiddleware(): void;
    registerRouter(): Promise<void>;
    registerRouterHooks(): Promise<void>;
    connectMicroservice<T extends object>(microserviceOptions: T, hybridAppOptions?: NestHybridApplicationOptions): INestMicroservice;
    getMicroservices(): INestMicroservice[];
    getHttpServer(): any;
    startAllMicroservices(callback?: () => void): this;
    startAllMicroservicesAsync(): Promise<void>;
    use(...args: [any, any?]): this;
    enableCors(options?: CorsOptions): void;
    listen(port: number | string, callback?: () => void): Promise<any>;
    listen(port: number | string, hostname: string, callback?: () => void): Promise<any>;
    listenAsync(port: number | string, hostname?: string): Promise<any>;
    getUrl(): Promise<string>;
    setGlobalPrefix(prefix: string): this;
    useWebSocketAdapter(adapter: WebSocketAdapter): this;
    useGlobalFilters(...filters: ExceptionFilter[]): this;
    useGlobalPipes(...pipes: PipeTransform<any>[]): this;
    useGlobalInterceptors(...interceptors: NestInterceptor[]): this;
    useGlobalGuards(...guards: CanActivate[]): this;
    useStaticAssets(options: any): this;
    useStaticAssets(path: string, options?: any): this;
    setBaseViewsDir(path: string | string[]): this;
    setViewEngine(engineOrOptions: any): this;
    private host;
    private getProtocol;
    private registerMiddleware;
    private listenToPromise;
}
