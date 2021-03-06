"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NestApplication = void 0;
const logger_service_1 = require("@nestjs/common/services/logger.service");
const load_package_util_1 = require("@nestjs/common/utils/load-package.util");
const shared_utils_1 = require("@nestjs/common/utils/shared.utils");
const iterare_1 = require("iterare");
const os_1 = require("os");
const application_config_1 = require("./application-config");
const constants_1 = require("./constants");
const optional_require_1 = require("./helpers/optional-require");
const container_1 = require("./middleware/container");
const middleware_module_1 = require("./middleware/middleware-module");
const nest_application_context_1 = require("./nest-application-context");
const routes_resolver_1 = require("./router/routes-resolver");
const { SocketModule } = optional_require_1.optionalRequire('@nestjs/websockets/socket-module', () => require('@nestjs/websockets/socket-module'));
const { MicroservicesModule, } = optional_require_1.optionalRequire('@nestjs/microservices/microservices-module', () => require('@nestjs/microservices/microservices-module'));
/**
 * @publicApi
 */
class NestApplication extends nest_application_context_1.NestApplicationContext {
    constructor(container, httpAdapter, config, appOptions = {}) {
        super(container);
        this.httpAdapter = httpAdapter;
        this.config = config;
        this.appOptions = appOptions;
        this.logger = new logger_service_1.Logger(NestApplication.name, true);
        this.middlewareModule = new middleware_module_1.MiddlewareModule();
        this.middlewareContainer = new container_1.MiddlewareContainer(this.container);
        this.microservicesModule = MicroservicesModule && new MicroservicesModule();
        this.socketModule = SocketModule && new SocketModule();
        this.microservices = [];
        this.isListening = false;
        this.selectContextModule();
        this.registerHttpServer();
        this.routesResolver = new routes_resolver_1.RoutesResolver(this.container, this.config, this.injector);
    }
    async dispose() {
        this.socketModule && (await this.socketModule.close());
        this.httpAdapter && (await this.httpAdapter.close());
        await Promise.all(iterare_1.iterate(this.microservices).map(async (microservice) => {
            microservice.setIsTerminated(true);
            await microservice.close();
        }));
    }
    getHttpAdapter() {
        return this.httpAdapter;
    }
    registerHttpServer() {
        this.httpServer = this.createServer();
    }
    getUnderlyingHttpServer() {
        return this.httpAdapter.getHttpServer();
    }
    applyOptions() {
        if (!this.appOptions || !this.appOptions.cors) {
            return undefined;
        }
        const isCorsOptionsObj = shared_utils_1.isObject(this.appOptions.cors);
        if (!isCorsOptionsObj) {
            return this.enableCors();
        }
        return this.enableCors(this.appOptions.cors);
    }
    createServer() {
        this.httpAdapter.initHttpServer(this.appOptions);
        return this.httpAdapter.getHttpServer();
    }
    async registerModules() {
        this.registerWsModule();
        if (this.microservicesModule) {
            this.microservicesModule.register(this.container, this.config);
            this.microservicesModule.setupClients(this.container);
        }
        await this.middlewareModule.register(this.middlewareContainer, this.container, this.config, this.injector, this.httpAdapter);
    }
    registerWsModule() {
        if (!this.socketModule) {
            return;
        }
        this.socketModule.register(this.container, this.config, this.httpServer);
    }
    async init() {
        var _a;
        this.applyOptions();
        await ((_a = this.httpAdapter) === null || _a === void 0 ? void 0 : _a.init());
        const useBodyParser = this.appOptions && this.appOptions.bodyParser !== false;
        useBodyParser && this.registerParserMiddleware();
        await this.registerModules();
        await this.registerRouter();
        await this.callInitHook();
        await this.registerRouterHooks();
        await this.callBootstrapHook();
        this.isInitialized = true;
        this.logger.log(constants_1.MESSAGES.APPLICATION_READY);
        return this;
    }
    registerParserMiddleware() {
        this.httpAdapter.registerParserMiddleware();
    }
    async registerRouter() {
        await this.registerMiddleware(this.httpAdapter);
        const prefix = this.config.getGlobalPrefix();
        const basePath = shared_utils_1.validatePath(prefix);
        this.routesResolver.resolve(this.httpAdapter, basePath);
    }
    async registerRouterHooks() {
        this.routesResolver.registerNotFoundHandler();
        this.routesResolver.registerExceptionHandler();
    }
    connectMicroservice(microserviceOptions, hybridAppOptions = {}) {
        const { NestMicroservice } = load_package_util_1.loadPackage('@nestjs/microservices', 'NestFactory', () => require('@nestjs/microservices'));
        const { inheritAppConfig } = hybridAppOptions;
        const applicationConfig = inheritAppConfig
            ? this.config
            : new application_config_1.ApplicationConfig();
        const instance = new NestMicroservice(this.container, microserviceOptions, applicationConfig);
        instance.registerListeners();
        instance.setIsInitialized(true);
        instance.setIsInitHookCalled(true);
        this.microservices.push(instance);
        return instance;
    }
    getMicroservices() {
        return this.microservices;
    }
    getHttpServer() {
        return this.httpServer;
    }
    startAllMicroservices(callback) {
        Promise.all(this.microservices.map(this.listenToPromise)).then(() => callback && callback());
        return this;
    }
    startAllMicroservicesAsync() {
        return new Promise(resolve => this.startAllMicroservices(resolve));
    }
    use(...args) {
        this.httpAdapter.use(...args);
        return this;
    }
    enableCors(options) {
        this.httpAdapter.enableCors(options);
    }
    async listen(port, ...args) {
        !this.isInitialized && (await this.init());
        this.httpAdapter.listen(port, ...args);
        this.isListening = true;
        return this.httpServer;
    }
    listenAsync(port, hostname) {
        return new Promise(resolve => {
            const server = this.listen(port, hostname, () => resolve(server));
        });
    }
    async getUrl() {
        return new Promise((resolve, reject) => {
            if (!this.isListening) {
                this.logger.error(constants_1.MESSAGES.CALL_LISTEN_FIRST);
                reject(constants_1.MESSAGES.CALL_LISTEN_FIRST);
            }
            this.httpServer.on('listening', () => {
                const address = this.httpServer.address();
                if (typeof address === 'string') {
                    if (os_1.platform() === 'win32') {
                        return address;
                    }
                    const basePath = encodeURIComponent(address);
                    return `${this.getProtocol()}+unix://${basePath}`;
                }
                let host = this.host();
                if (address && address.family === 'IPv6') {
                    if (host === '::') {
                        host = '[::1]';
                    }
                    else {
                        host = `[${host}]`;
                    }
                }
                else if (host === '0.0.0.0') {
                    host = '127.0.0.1';
                }
                resolve(`${this.getProtocol()}://${host}:${address.port}`);
            });
        });
    }
    setGlobalPrefix(prefix) {
        this.config.setGlobalPrefix(prefix);
        return this;
    }
    useWebSocketAdapter(adapter) {
        this.config.setIoAdapter(adapter);
        return this;
    }
    useGlobalFilters(...filters) {
        this.config.useGlobalFilters(...filters);
        return this;
    }
    useGlobalPipes(...pipes) {
        this.config.useGlobalPipes(...pipes);
        return this;
    }
    useGlobalInterceptors(...interceptors) {
        this.config.useGlobalInterceptors(...interceptors);
        return this;
    }
    useGlobalGuards(...guards) {
        this.config.useGlobalGuards(...guards);
        return this;
    }
    useStaticAssets(pathOrOptions, options) {
        this.httpAdapter.useStaticAssets &&
            this.httpAdapter.useStaticAssets(pathOrOptions, options);
        return this;
    }
    setBaseViewsDir(path) {
        this.httpAdapter.setBaseViewsDir && this.httpAdapter.setBaseViewsDir(path);
        return this;
    }
    setViewEngine(engineOrOptions) {
        this.httpAdapter.setViewEngine &&
            this.httpAdapter.setViewEngine(engineOrOptions);
        return this;
    }
    host() {
        const address = this.httpServer.address();
        if (typeof address === 'string') {
            return undefined;
        }
        return address && address.address;
    }
    getProtocol() {
        return this.appOptions && this.appOptions.httpsOptions ? 'https' : 'http';
    }
    async registerMiddleware(instance) {
        await this.middlewareModule.registerMiddleware(this.middlewareContainer, instance);
    }
    listenToPromise(microservice) {
        return new Promise(async (resolve) => {
            await microservice.listen(resolve);
        });
    }
}
exports.NestApplication = NestApplication;
