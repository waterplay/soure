"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependenciesScanner = void 0;
const common_1 = require("@nestjs/common");
const constants_1 = require("@nestjs/common/constants");
const interfaces_1 = require("@nestjs/common/interfaces");
const random_string_generator_util_1 = require("@nestjs/common/utils/random-string-generator.util");
const shared_utils_1 = require("@nestjs/common/utils/shared.utils");
const iterare_1 = require("iterare");
const application_config_1 = require("./application-config");
const constants_2 = require("./constants");
const circular_dependency_exception_1 = require("./errors/exceptions/circular-dependency.exception");
const get_class_scope_1 = require("./helpers/get-class-scope");
const invalid_module_exception_1 = require("./errors/exceptions/invalid-module.exception");
const undefined_module_exception_1 = require("./errors/exceptions/undefined-module.exception");
class DependenciesScanner {
    constructor(container, metadataScanner, applicationConfig = new application_config_1.ApplicationConfig()) {
        this.container = container;
        this.metadataScanner = metadataScanner;
        this.applicationConfig = applicationConfig;
        this.applicationProvidersApplyMap = [];
    }
    async scan(module) {
        await this.registerCoreModule();
        await this.scanForModules(module);
        await this.scanModulesForDependencies();
        this.addScopedEnhancersMetadata();
        this.container.bindGlobalScope();
    }
    async scanForModules(module, scope = [], ctxRegistry = []) {
        const moduleInstance = await this.insertModule(module, scope);
        ctxRegistry.push(module);
        if (this.isForwardReference(module)) {
            module = module.forwardRef();
        }
        const modules = !this.isDynamicModule(module)
            ? this.reflectMetadata(module, constants_1.MODULE_METADATA.IMPORTS)
            : [
                ...this.reflectMetadata(module.module, constants_1.MODULE_METADATA.IMPORTS),
                ...(module.imports || []),
            ];
        for (const [index, innerModule] of modules.entries()) {
            // In case of a circular dependency (ES module system), JavaScript will resolve the type to `undefined`.
            if (innerModule === undefined) {
                throw new undefined_module_exception_1.UndefinedModuleException(module, index, scope);
            }
            if (!innerModule) {
                throw new invalid_module_exception_1.InvalidModuleException(module, index, scope);
            }
            if (ctxRegistry.includes(innerModule)) {
                continue;
            }
            await this.scanForModules(innerModule, [].concat(scope, module), ctxRegistry);
        }
        return moduleInstance;
    }
    async insertModule(module, scope) {
        if (module && module.forwardRef) {
            return this.container.addModule(module.forwardRef(), scope);
        }
        return this.container.addModule(module, scope);
    }
    async scanModulesForDependencies() {
        const modules = this.container.getModules();
        for (const [token, { metatype }] of modules) {
            await this.reflectImports(metatype, token, metatype.name);
            this.reflectProviders(metatype, token);
            this.reflectControllers(metatype, token);
            this.reflectExports(metatype, token);
        }
        this.calculateModulesDistance(modules);
    }
    async reflectImports(module, token, context) {
        const modules = [
            ...this.reflectMetadata(module, constants_1.MODULE_METADATA.IMPORTS),
            ...this.container.getDynamicMetadataByToken(token, constants_1.MODULE_METADATA.IMPORTS),
        ];
        for (const related of modules) {
            await this.insertImport(related, token, context);
        }
    }
    reflectProviders(module, token) {
        const providers = [
            ...this.reflectMetadata(module, constants_1.MODULE_METADATA.PROVIDERS),
            ...this.container.getDynamicMetadataByToken(token, constants_1.MODULE_METADATA.PROVIDERS),
        ];
        providers.forEach(provider => {
            this.insertProvider(provider, token);
            this.reflectDynamicMetadata(provider, token);
        });
    }
    reflectControllers(module, token) {
        const controllers = [
            ...this.reflectMetadata(module, constants_1.MODULE_METADATA.CONTROLLERS),
            ...this.container.getDynamicMetadataByToken(token, constants_1.MODULE_METADATA.CONTROLLERS),
        ];
        controllers.forEach(item => {
            this.insertController(item, token);
            this.reflectDynamicMetadata(item, token);
        });
    }
    reflectDynamicMetadata(obj, token) {
        if (!obj || !obj.prototype) {
            return;
        }
        this.reflectInjectables(obj, token, constants_1.GUARDS_METADATA);
        this.reflectInjectables(obj, token, constants_1.INTERCEPTORS_METADATA);
        this.reflectInjectables(obj, token, constants_1.EXCEPTION_FILTERS_METADATA);
        this.reflectInjectables(obj, token, constants_1.PIPES_METADATA);
        this.reflectParamInjectables(obj, token, constants_1.ROUTE_ARGS_METADATA);
    }
    reflectExports(module, token) {
        const exports = [
            ...this.reflectMetadata(module, constants_1.MODULE_METADATA.EXPORTS),
            ...this.container.getDynamicMetadataByToken(token, constants_1.MODULE_METADATA.EXPORTS),
        ];
        exports.forEach(exportedProvider => this.insertExportedProvider(exportedProvider, token));
    }
    reflectInjectables(component, token, metadataKey) {
        const controllerInjectables = this.reflectMetadata(component, metadataKey);
        const methodsInjectables = this.metadataScanner.scanFromPrototype(null, component.prototype, this.reflectKeyMetadata.bind(this, component, metadataKey));
        const flattenMethodsInjectables = this.flatten(methodsInjectables);
        const combinedInjectables = [
            ...controllerInjectables,
            ...flattenMethodsInjectables,
        ].filter(shared_utils_1.isFunction);
        const injectables = Array.from(new Set(combinedInjectables));
        injectables.forEach(injectable => this.insertInjectable(injectable, token, component));
    }
    reflectParamInjectables(component, token, metadataKey) {
        const paramsMetadata = this.metadataScanner.scanFromPrototype(null, component.prototype, method => Reflect.getMetadata(metadataKey, component, method));
        const paramsInjectables = this.flatten(paramsMetadata).map((param) => common_1.flatten(Object.keys(param).map(k => param[k].pipes)).filter(shared_utils_1.isFunction));
        common_1.flatten(paramsInjectables).forEach((injectable) => this.insertInjectable(injectable, token, component));
    }
    reflectKeyMetadata(component, key, method) {
        let prototype = component.prototype;
        do {
            const descriptor = Reflect.getOwnPropertyDescriptor(prototype, method);
            if (!descriptor) {
                continue;
            }
            return Reflect.getMetadata(key, descriptor.value);
        } while ((prototype = Reflect.getPrototypeOf(prototype)) &&
            prototype !== Object.prototype &&
            prototype);
        return undefined;
    }
    async calculateModulesDistance(modules) {
        const modulesGenerator = modules.values();
        const rootModule = modulesGenerator.next().value;
        const modulesStack = [rootModule];
        const calculateDistance = (moduleRef, distance = 1) => {
            if (modulesStack.includes(moduleRef)) {
                return;
            }
            modulesStack.push(moduleRef);
            const moduleImports = rootModule.relatedModules;
            moduleImports.forEach(module => {
                module.distance = distance;
                calculateDistance(module, distance + 1);
            });
        };
        calculateDistance(rootModule);
    }
    async insertImport(related, token, context) {
        if (shared_utils_1.isUndefined(related)) {
            throw new circular_dependency_exception_1.CircularDependencyException(context);
        }
        if (related && related.forwardRef) {
            return this.container.addImport(related.forwardRef(), token);
        }
        await this.container.addImport(related, token);
    }
    isCustomProvider(provider) {
        return provider && !shared_utils_1.isNil(provider.provide);
    }
    insertProvider(provider, token) {
        const isCustomProvider = this.isCustomProvider(provider);
        if (!isCustomProvider) {
            return this.container.addProvider(provider, token);
        }
        const applyProvidersMap = this.getApplyProvidersMap();
        const providersKeys = Object.keys(applyProvidersMap);
        const type = provider.provide;
        if (!providersKeys.includes(type)) {
            return this.container.addProvider(provider, token);
        }
        const providerToken = `${type} (UUID: ${random_string_generator_util_1.randomStringGenerator()})`;
        let scope = provider.scope;
        if (shared_utils_1.isNil(scope) && provider.useClass) {
            scope = get_class_scope_1.getClassScope(provider.useClass);
        }
        this.applicationProvidersApplyMap.push({
            type,
            moduleKey: token,
            providerKey: providerToken,
            scope,
        });
        const newProvider = Object.assign(Object.assign({}, provider), { provide: providerToken, scope });
        if (this.isRequestOrTransient(newProvider.scope)) {
            return this.container.addInjectable(newProvider, token);
        }
        this.container.addProvider(newProvider, token);
    }
    insertInjectable(injectable, token, host) {
        this.container.addInjectable(injectable, token, host);
    }
    insertExportedProvider(exportedProvider, token) {
        this.container.addExportedProvider(exportedProvider, token);
    }
    insertController(controller, token) {
        this.container.addController(controller, token);
    }
    reflectMetadata(metatype, metadataKey) {
        return Reflect.getMetadata(metadataKey, metatype) || [];
    }
    async registerCoreModule() {
        const module = this.container.createCoreModule();
        const instance = await this.scanForModules(module);
        this.container.registerCoreModuleRef(instance);
    }
    /**
     * Add either request or transient globally scoped enhancers
     * to all controllers metadata storage
     */
    addScopedEnhancersMetadata() {
        iterare_1.iterate(this.applicationProvidersApplyMap)
            .filter(wrapper => this.isRequestOrTransient(wrapper.scope))
            .forEach(({ moduleKey, providerKey }) => {
            const modulesContainer = this.container.getModules();
            const { injectables } = modulesContainer.get(moduleKey);
            const instanceWrapper = injectables.get(providerKey);
            iterare_1.iterate(modulesContainer.values())
                .map(module => module.controllers.values())
                .flatten()
                .forEach(controller => controller.addEnhancerMetadata(instanceWrapper));
        });
    }
    applyApplicationProviders() {
        const applyProvidersMap = this.getApplyProvidersMap();
        const applyRequestProvidersMap = this.getApplyRequestProvidersMap();
        const getInstanceWrapper = (moduleKey, providerKey, collectionKey) => {
            const modules = this.container.getModules();
            const collection = modules.get(moduleKey)[collectionKey];
            return collection.get(providerKey);
        };
        // Add global enhancers to the application config
        this.applicationProvidersApplyMap.forEach(({ moduleKey, providerKey, type, scope }) => {
            let instanceWrapper;
            if (this.isRequestOrTransient(scope)) {
                instanceWrapper = getInstanceWrapper(moduleKey, providerKey, 'injectables');
                return applyRequestProvidersMap[type](instanceWrapper);
            }
            instanceWrapper = getInstanceWrapper(moduleKey, providerKey, 'providers');
            applyProvidersMap[type](instanceWrapper.instance);
        });
    }
    getApplyProvidersMap() {
        return {
            [constants_2.APP_INTERCEPTOR]: (interceptor) => this.applicationConfig.addGlobalInterceptor(interceptor),
            [constants_2.APP_PIPE]: (pipe) => this.applicationConfig.addGlobalPipe(pipe),
            [constants_2.APP_GUARD]: (guard) => this.applicationConfig.addGlobalGuard(guard),
            [constants_2.APP_FILTER]: (filter) => this.applicationConfig.addGlobalFilter(filter),
        };
    }
    getApplyRequestProvidersMap() {
        return {
            [constants_2.APP_INTERCEPTOR]: (interceptor) => this.applicationConfig.addGlobalRequestInterceptor(interceptor),
            [constants_2.APP_PIPE]: (pipe) => this.applicationConfig.addGlobalRequestPipe(pipe),
            [constants_2.APP_GUARD]: (guard) => this.applicationConfig.addGlobalRequestGuard(guard),
            [constants_2.APP_FILTER]: (filter) => this.applicationConfig.addGlobalRequestFilter(filter),
        };
    }
    isDynamicModule(module) {
        return module && !!module.module;
    }
    isForwardReference(module) {
        return module && !!module.forwardRef;
    }
    flatten(arr) {
        return arr.reduce((a, b) => a.concat(b), []);
    }
    isRequestOrTransient(scope) {
        return scope === interfaces_1.Scope.REQUEST || scope === interfaces_1.Scope.TRANSIENT;
    }
}
exports.DependenciesScanner = DependenciesScanner;
