"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiddlewareModule = void 0;
const shared_utils_1 = require("@nestjs/common/utils/shared.utils");
const invalid_middleware_exception_1 = require("../errors/exceptions/invalid-middleware.exception");
const runtime_exception_1 = require("../errors/exceptions/runtime.exception");
const context_id_factory_1 = require("../helpers/context-id-factory");
const execution_context_host_1 = require("../helpers/execution-context-host");
const constants_1 = require("../injector/constants");
const request_constants_1 = require("../router/request/request-constants");
const router_exception_filters_1 = require("../router/router-exception-filters");
const router_proxy_1 = require("../router/router-proxy");
const builder_1 = require("./builder");
const resolver_1 = require("./resolver");
const routes_mapper_1 = require("./routes-mapper");
class MiddlewareModule {
    constructor() {
        this.routerProxy = new router_proxy_1.RouterProxy();
        this.exceptionFiltersCache = new WeakMap();
    }
    async register(middlewareContainer, container, config, injector, httpAdapter) {
        const appRef = container.getHttpAdapterRef();
        this.routerExceptionFilter = new router_exception_filters_1.RouterExceptionFilters(container, config, appRef);
        this.routesMapper = new routes_mapper_1.RoutesMapper(container);
        this.resolver = new resolver_1.MiddlewareResolver(middlewareContainer);
        this.config = config;
        this.injector = injector;
        this.container = container;
        this.httpAdapter = httpAdapter;
        const modules = container.getModules();
        await this.resolveMiddleware(middlewareContainer, modules);
    }
    async resolveMiddleware(middlewareContainer, modules) {
        const moduleEntries = [...modules.entries()];
        const loadMiddlewareConfiguration = async ([name, module]) => {
            const instance = module.instance;
            await this.loadConfiguration(middlewareContainer, instance, name);
            await this.resolver.resolveInstances(module, name);
        };
        await Promise.all(moduleEntries.map(loadMiddlewareConfiguration));
    }
    async loadConfiguration(middlewareContainer, instance, moduleKey) {
        if (!instance.configure) {
            return;
        }
        const middlewareBuilder = new builder_1.MiddlewareBuilder(this.routesMapper, this.httpAdapter);
        await instance.configure(middlewareBuilder);
        if (!(middlewareBuilder instanceof builder_1.MiddlewareBuilder)) {
            return;
        }
        const config = middlewareBuilder.build();
        middlewareContainer.insertConfig(config, moduleKey);
    }
    async registerMiddleware(middlewareContainer, applicationRef) {
        const configs = middlewareContainer.getConfigurations();
        const registerAllConfigs = (moduleKey, middlewareConfig) => middlewareConfig.map(async (config) => {
            await this.registerMiddlewareConfig(middlewareContainer, config, moduleKey, applicationRef);
        });
        const entriesSortedByDistance = [...configs.entries()].sort(([moduleA], [moduleB]) => {
            return (this.container.getModuleByKey(moduleA).distance -
                this.container.getModuleByKey(moduleB).distance);
        });
        const registerModuleConfigs = async ([module, moduleConfigs]) => {
            await Promise.all(registerAllConfigs(module, [...moduleConfigs]));
        };
        await Promise.all(entriesSortedByDistance.map(registerModuleConfigs));
    }
    async registerMiddlewareConfig(middlewareContainer, config, moduleKey, applicationRef) {
        const { forRoutes } = config;
        const registerRouteMiddleware = async (routeInfo) => {
            await this.registerRouteMiddleware(middlewareContainer, routeInfo, config, moduleKey, applicationRef);
        };
        await Promise.all(forRoutes.map(registerRouteMiddleware));
    }
    async registerRouteMiddleware(middlewareContainer, routeInfo, config, moduleKey, applicationRef) {
        const middlewareCollection = [].concat(config.middleware);
        const moduleRef = this.container.getModuleByKey(moduleKey);
        await Promise.all(middlewareCollection.map(async (metatype) => {
            const collection = middlewareContainer.getMiddlewareCollection(moduleKey);
            const instanceWrapper = collection.get(metatype.name);
            if (shared_utils_1.isUndefined(instanceWrapper)) {
                throw new runtime_exception_1.RuntimeException();
            }
            await this.bindHandler(instanceWrapper, applicationRef, routeInfo.method, routeInfo.path, moduleRef, collection);
        }));
    }
    async bindHandler(wrapper, applicationRef, method, path, moduleRef, collection) {
        const { instance, metatype } = wrapper;
        if (shared_utils_1.isUndefined(instance.use)) {
            throw new invalid_middleware_exception_1.InvalidMiddlewareException(metatype.name);
        }
        const router = await applicationRef.createMiddlewareFactory(method);
        const isStatic = wrapper.isDependencyTreeStatic();
        if (isStatic) {
            const proxy = await this.createProxy(instance);
            return this.registerHandler(router, path, proxy);
        }
        this.registerHandler(router, path, async (req, res, next) => {
            try {
                const contextId = context_id_factory_1.ContextIdFactory.getByRequest(req);
                if (!req[request_constants_1.REQUEST_CONTEXT_ID]) {
                    Object.defineProperty(req, request_constants_1.REQUEST_CONTEXT_ID, {
                        value: contextId,
                        enumerable: false,
                        writable: false,
                        configurable: false,
                    });
                    this.container.registerRequestProvider(req, contextId);
                }
                const contextInstance = await this.injector.loadPerContext(instance, moduleRef, collection, contextId);
                const proxy = await this.createProxy(contextInstance, contextId);
                return proxy(req, res, next);
            }
            catch (err) {
                let exceptionsHandler = this.exceptionFiltersCache.get(instance.use);
                if (!exceptionsHandler) {
                    exceptionsHandler = this.routerExceptionFilter.create(instance, instance.use, undefined);
                    this.exceptionFiltersCache.set(instance.use, exceptionsHandler);
                }
                const host = new execution_context_host_1.ExecutionContextHost([req, res, next]);
                exceptionsHandler.next(err, host);
            }
        });
    }
    async createProxy(instance, contextId = constants_1.STATIC_CONTEXT) {
        const exceptionsHandler = this.routerExceptionFilter.create(instance, instance.use, undefined, contextId);
        const middleware = instance.use.bind(instance);
        return this.routerProxy.createProxy(middleware, exceptionsHandler);
    }
    registerHandler(router, path, proxy) {
        const prefix = this.config.getGlobalPrefix();
        const basePath = shared_utils_1.validatePath(prefix);
        if (basePath && path === '/*') {
            // strip slash when a wildcard is being used
            // and global prefix has been set
            path = '*';
        }
        router(basePath + path, proxy);
    }
}
exports.MiddlewareModule = MiddlewareModule;
