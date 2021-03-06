"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoutesResolver = void 0;
const common_1 = require("@nestjs/common");
const constants_1 = require("@nestjs/common/constants");
const logger_service_1 = require("@nestjs/common/services/logger.service");
const messages_1 = require("../helpers/messages");
const metadata_scanner_1 = require("../metadata-scanner");
const router_exception_filters_1 = require("./router-exception-filters");
const router_explorer_1 = require("./router-explorer");
const router_proxy_1 = require("./router-proxy");
class RoutesResolver {
    constructor(container, config, injector) {
        this.container = container;
        this.config = config;
        this.injector = injector;
        this.logger = new logger_service_1.Logger(RoutesResolver.name, true);
        this.routerProxy = new router_proxy_1.RouterProxy();
        this.routerExceptionsFilter = new router_exception_filters_1.RouterExceptionFilters(container, config, container.getHttpAdapterRef());
        const metadataScanner = new metadata_scanner_1.MetadataScanner();
        this.routerExplorer = new router_explorer_1.RouterExplorer(metadataScanner, this.container, this.injector, this.routerProxy, this.routerExceptionsFilter, this.config);
    }
    resolve(applicationRef, basePath) {
        const modules = this.container.getModules();
        modules.forEach(({ controllers, metatype }, moduleName) => {
            let path = metatype ? this.getModulePathMetadata(metatype) : undefined;
            path = path ? basePath + path : basePath;
            this.registerRouters(controllers, moduleName, path, applicationRef);
        });
    }
    registerRouters(routes, moduleName, basePath, applicationRef) {
        routes.forEach(instanceWrapper => {
            const { metatype } = instanceWrapper;
            const host = this.getHostMetadata(metatype);
            const path = this.routerExplorer.extractRouterPath(metatype, basePath);
            const controllerName = metatype.name;
            this.logger.log(messages_1.CONTROLLER_MAPPING_MESSAGE(controllerName, this.routerExplorer.stripEndSlash(path)));
            this.routerExplorer.explore(instanceWrapper, moduleName, applicationRef, path, host);
        });
    }
    registerNotFoundHandler() {
        const applicationRef = this.container.getHttpAdapterRef();
        const callback = (req, res) => {
            const method = applicationRef.getRequestMethod(req);
            const url = applicationRef.getRequestUrl(req);
            throw new common_1.NotFoundException(`Cannot ${method} ${url}`);
        };
        const handler = this.routerExceptionsFilter.create({}, callback, undefined);
        const proxy = this.routerProxy.createProxy(callback, handler);
        applicationRef.setNotFoundHandler &&
            applicationRef.setNotFoundHandler(proxy, this.config.getGlobalPrefix());
    }
    registerExceptionHandler() {
        const callback = (err, req, res, next) => {
            throw this.mapExternalException(err);
        };
        const handler = this.routerExceptionsFilter.create({}, callback, undefined);
        const proxy = this.routerProxy.createExceptionLayerProxy(callback, handler);
        const applicationRef = this.container.getHttpAdapterRef();
        applicationRef.setErrorHandler &&
            applicationRef.setErrorHandler(proxy, this.config.getGlobalPrefix());
    }
    mapExternalException(err) {
        switch (true) {
            case err instanceof SyntaxError:
                return new common_1.BadRequestException(err.message);
            default:
                return err;
        }
    }
    getModulePathMetadata(metatype) {
        return Reflect.getMetadata(constants_1.MODULE_PATH, metatype);
    }
    getHostMetadata(metatype) {
        return Reflect.getMetadata(constants_1.HOST_METADATA, metatype);
    }
}
exports.RoutesResolver = RoutesResolver;
