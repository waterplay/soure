"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouterExplorer = void 0;
const constants_1 = require("@nestjs/common/constants");
const exceptions_1 = require("@nestjs/common/exceptions");
const logger_service_1 = require("@nestjs/common/services/logger.service");
const shared_utils_1 = require("@nestjs/common/utils/shared.utils");
const pathToRegexp = require("path-to-regexp");
const unknown_request_mapping_exception_1 = require("../errors/exceptions/unknown-request-mapping.exception");
const guards_consumer_1 = require("../guards/guards-consumer");
const guards_context_creator_1 = require("../guards/guards-context-creator");
const context_id_factory_1 = require("../helpers/context-id-factory");
const execution_context_host_1 = require("../helpers/execution-context-host");
const messages_1 = require("../helpers/messages");
const router_method_factory_1 = require("../helpers/router-method-factory");
const constants_2 = require("../injector/constants");
const interceptors_consumer_1 = require("../interceptors/interceptors-consumer");
const interceptors_context_creator_1 = require("../interceptors/interceptors-context-creator");
const pipes_consumer_1 = require("../pipes/pipes-consumer");
const pipes_context_creator_1 = require("../pipes/pipes-context-creator");
const request_constants_1 = require("./request/request-constants");
const route_params_factory_1 = require("./route-params-factory");
const router_execution_context_1 = require("./router-execution-context");
class RouterExplorer {
    constructor(metadataScanner, container, injector, routerProxy, exceptionsFilter, config) {
        this.metadataScanner = metadataScanner;
        this.container = container;
        this.injector = injector;
        this.routerProxy = routerProxy;
        this.exceptionsFilter = exceptionsFilter;
        this.routerMethodFactory = new router_method_factory_1.RouterMethodFactory();
        this.logger = new logger_service_1.Logger(RouterExplorer.name, true);
        this.exceptionFiltersCache = new WeakMap();
        this.executionContextCreator = new router_execution_context_1.RouterExecutionContext(new route_params_factory_1.RouteParamsFactory(), new pipes_context_creator_1.PipesContextCreator(container, config), new pipes_consumer_1.PipesConsumer(), new guards_context_creator_1.GuardsContextCreator(container, config), new guards_consumer_1.GuardsConsumer(), new interceptors_context_creator_1.InterceptorsContextCreator(container, config), new interceptors_consumer_1.InterceptorsConsumer(), container.getHttpAdapterRef());
    }
    explore(instanceWrapper, module, applicationRef, basePath, host) {
        const { instance } = instanceWrapper;
        const routerPaths = this.scanForPaths(instance);
        this.applyPathsToRouterProxy(applicationRef, routerPaths, instanceWrapper, module, basePath, host);
    }
    extractRouterPath(metatype, prefix) {
        let path = Reflect.getMetadata(constants_1.PATH_METADATA, metatype);
        if (prefix)
            path = prefix + this.validateRoutePath(path);
        return this.validateRoutePath(path);
    }
    validateRoutePath(path) {
        if (shared_utils_1.isUndefined(path)) {
            throw new unknown_request_mapping_exception_1.UnknownRequestMappingException();
        }
        return shared_utils_1.validatePath(path);
    }
    scanForPaths(instance, prototype) {
        const instancePrototype = shared_utils_1.isUndefined(prototype)
            ? Object.getPrototypeOf(instance)
            : prototype;
        return this.metadataScanner.scanFromPrototype(instance, instancePrototype, method => this.exploreMethodMetadata(instance, instancePrototype, method));
    }
    exploreMethodMetadata(instance, prototype, methodName) {
        const targetCallback = prototype[methodName];
        const routePath = Reflect.getMetadata(constants_1.PATH_METADATA, targetCallback);
        if (shared_utils_1.isUndefined(routePath)) {
            return null;
        }
        const requestMethod = Reflect.getMetadata(constants_1.METHOD_METADATA, targetCallback);
        const path = shared_utils_1.isString(routePath)
            ? [this.validateRoutePath(routePath)]
            : routePath.map(p => this.validateRoutePath(p));
        return {
            path,
            requestMethod,
            targetCallback,
            methodName,
        };
    }
    applyPathsToRouterProxy(router, routePaths, instanceWrapper, moduleKey, basePath, host) {
        (routePaths || []).forEach(pathProperties => {
            const { path, requestMethod } = pathProperties;
            this.applyCallbackToRouter(router, pathProperties, instanceWrapper, moduleKey, basePath, host);
            path.forEach(item => {
                const pathStr = this.stripEndSlash(basePath) + this.stripEndSlash(item);
                this.logger.log(messages_1.ROUTE_MAPPED_MESSAGE(pathStr, requestMethod));
            });
        });
    }
    stripEndSlash(str) {
        return str[str.length - 1] === '/' ? str.slice(0, str.length - 1) : str;
    }
    applyCallbackToRouter(router, pathProperties, instanceWrapper, moduleKey, basePath, host) {
        const { path: paths, requestMethod, targetCallback, methodName, } = pathProperties;
        const { instance } = instanceWrapper;
        const routerMethod = this.routerMethodFactory
            .get(router, requestMethod)
            .bind(router);
        const isRequestScoped = !instanceWrapper.isDependencyTreeStatic();
        const proxy = isRequestScoped
            ? this.createRequestScopedHandler(instanceWrapper, requestMethod, this.container.getModuleByKey(moduleKey), moduleKey, methodName)
            : this.createCallbackProxy(instance, targetCallback, methodName, moduleKey, requestMethod);
        const hostHandler = this.applyHostFilter(host, proxy);
        paths.forEach(path => {
            const fullPath = this.stripEndSlash(basePath) + path;
            routerMethod(this.stripEndSlash(fullPath) || '/', hostHandler);
        });
    }
    applyHostFilter(host, handler) {
        if (!host) {
            return handler;
        }
        const httpAdapterRef = this.container.getHttpAdapterRef();
        const keys = [];
        const re = pathToRegexp(host, keys);
        return (req, res, next) => {
            req.hosts = {};
            const hostname = httpAdapterRef.getRequestHostname(req) || '';
            const match = hostname.match(re);
            if (match) {
                keys.forEach((key, i) => (req.hosts[key.name] = match[i + 1]));
                return handler(req, res, next);
            }
            if (!next) {
                throw new exceptions_1.InternalServerErrorException(`HTTP adapter does not support filtering on host: "${host}"`);
            }
            return next();
        };
    }
    createCallbackProxy(instance, callback, methodName, moduleRef, requestMethod, contextId = constants_2.STATIC_CONTEXT, inquirerId) {
        const executionContext = this.executionContextCreator.create(instance, callback, methodName, moduleRef, requestMethod, contextId, inquirerId);
        const exceptionFilter = this.exceptionsFilter.create(instance, callback, moduleRef, contextId, inquirerId);
        return this.routerProxy.createProxy(executionContext, exceptionFilter);
    }
    createRequestScopedHandler(instanceWrapper, requestMethod, moduleRef, moduleKey, methodName) {
        const { instance } = instanceWrapper;
        const collection = moduleRef.controllers;
        return async (req, res, next) => {
            try {
                const contextId = this.getContextId(req);
                const contextInstance = await this.injector.loadPerContext(instance, moduleRef, collection, contextId);
                await this.createCallbackProxy(contextInstance, contextInstance[methodName], methodName, moduleKey, requestMethod, contextId, instanceWrapper.id)(req, res, next);
            }
            catch (err) {
                let exceptionFilter = this.exceptionFiltersCache.get(instance[methodName]);
                if (!exceptionFilter) {
                    exceptionFilter = this.exceptionsFilter.create(instance, instance[methodName], moduleKey);
                    this.exceptionFiltersCache.set(instance[methodName], exceptionFilter);
                }
                const host = new execution_context_host_1.ExecutionContextHost([req, res, next]);
                exceptionFilter.next(err, host);
            }
        };
    }
    getContextId(request) {
        const contextId = context_id_factory_1.ContextIdFactory.getByRequest(request);
        if (!request[request_constants_1.REQUEST_CONTEXT_ID]) {
            Object.defineProperty(request, request_constants_1.REQUEST_CONTEXT_ID, {
                value: contextId,
                enumerable: false,
                writable: false,
                configurable: false,
            });
            this.container.registerRequestProvider(request, contextId);
        }
        return contextId;
    }
}
exports.RouterExplorer = RouterExplorer;
