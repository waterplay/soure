import { CanActivate, ExceptionFilter, NestInterceptor, PipeTransform, WebSocketAdapter } from '@nestjs/common';
import { InstanceWrapper } from './injector/instance-wrapper';
export declare class ApplicationConfig {
    private ioAdapter;
    private globalPrefix;
    private globalPipes;
    private globalFilters;
    private globalInterceptors;
    private globalGuards;
    private readonly globalRequestPipes;
    private readonly globalRequestFilters;
    private readonly globalRequestInterceptors;
    private readonly globalRequestGuards;
    constructor(ioAdapter?: WebSocketAdapter | null);
    setGlobalPrefix(prefix: string): void;
    getGlobalPrefix(): string;
    setIoAdapter(ioAdapter: WebSocketAdapter): void;
    getIoAdapter(): WebSocketAdapter;
    addGlobalPipe(pipe: PipeTransform<any>): void;
    useGlobalPipes(...pipes: PipeTransform<any>[]): void;
    getGlobalFilters(): ExceptionFilter[];
    addGlobalFilter(filter: ExceptionFilter): void;
    useGlobalFilters(...filters: ExceptionFilter[]): void;
    getGlobalPipes(): PipeTransform<any>[];
    getGlobalInterceptors(): NestInterceptor[];
    addGlobalInterceptor(interceptor: NestInterceptor): void;
    useGlobalInterceptors(...interceptors: NestInterceptor[]): void;
    getGlobalGuards(): CanActivate[];
    addGlobalGuard(guard: CanActivate): void;
    useGlobalGuards(...guards: CanActivate[]): void;
    addGlobalRequestInterceptor(wrapper: InstanceWrapper<NestInterceptor>): void;
    getGlobalRequestInterceptors(): InstanceWrapper<NestInterceptor>[];
    addGlobalRequestPipe(wrapper: InstanceWrapper<PipeTransform>): void;
    getGlobalRequestPipes(): InstanceWrapper<PipeTransform>[];
    addGlobalRequestFilter(wrapper: InstanceWrapper<ExceptionFilter>): void;
    getGlobalRequestFilters(): InstanceWrapper<ExceptionFilter>[];
    addGlobalRequestGuard(wrapper: InstanceWrapper<CanActivate>): void;
    getGlobalRequestGuards(): InstanceWrapper<CanActivate>[];
}