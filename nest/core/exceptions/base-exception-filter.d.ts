import { ArgumentsHost, ExceptionFilter, HttpServer } from '@nestjs/common';
import { AbstractHttpAdapter } from '../adapters';
import { HttpAdapterHost } from '../helpers';
export declare class BaseExceptionFilter<T = any> implements ExceptionFilter<T> {
    protected readonly applicationRef?: HttpServer;
    private static readonly logger;
    protected readonly httpAdapterHost?: HttpAdapterHost;
    constructor(applicationRef?: HttpServer);
    catch(exception: T, host: ArgumentsHost): void;
    handleUnknownError(exception: T, host: ArgumentsHost, applicationRef: AbstractHttpAdapter | HttpServer): void;
    isExceptionObject(err: any): err is Error;
}
