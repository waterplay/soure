"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NestFactory = exports.NestFactoryStatic = void 0;
const logger_service_1 = require("@nestjs/common/services/logger.service");
const load_package_util_1 = require("@nestjs/common/utils/load-package.util");
const shared_utils_1 = require("@nestjs/common/utils/shared.utils");
const application_config_1 = require("./application-config");
const constants_1 = require("./constants");
const exceptions_zone_1 = require("./errors/exceptions-zone");
const load_adapter_1 = require("./helpers/load-adapter");
const container_1 = require("./injector/container");
const instance_loader_1 = require("./injector/instance-loader");
const metadata_scanner_1 = require("./metadata-scanner");
const nest_application_1 = require("./nest-application");
const nest_application_context_1 = require("./nest-application-context");
const scanner_1 = require("./scanner");
/**
 * @publicApi
 */
class NestFactoryStatic {
    constructor() {
        this.logger = new logger_service_1.Logger('NestFactory', true);
    }
    async create(module, serverOrOptions, options) {
        const [httpServer, appOptions] = this.isHttpServer(serverOrOptions)
            ? [serverOrOptions, options]
            : [this.createHttpAdapter(), serverOrOptions];
        const applicationConfig = new application_config_1.ApplicationConfig();
        const container = new container_1.NestContainer(applicationConfig);
        this.applyLogger(appOptions);
        await this.initialize(module, container, applicationConfig, httpServer);
        const instance = new nest_application_1.NestApplication(container, httpServer, applicationConfig, appOptions);
        const target = this.createNestInstance(instance);
        return this.createAdapterProxy(target, httpServer);
    }
    /**
     * Creates an instance of NestMicroservice.
     *
     * @param module Entry (root) application module class
     * @param options Optional microservice configuration
     *
     * @returns A promise that, when resolved,
     * contains a reference to the NestMicroservice instance.
     */
    async createMicroservice(module, options) {
        const { NestMicroservice } = load_package_util_1.loadPackage('@nestjs/microservices', 'NestFactory', () => require('@nestjs/microservices'));
        const applicationConfig = new application_config_1.ApplicationConfig();
        const container = new container_1.NestContainer(applicationConfig);
        this.applyLogger(options);
        await this.initialize(module, container, applicationConfig);
        return this.createNestInstance(new NestMicroservice(container, options, applicationConfig));
    }
    /**
     * Creates an instance of NestApplicationContext.
     *
     * @param module Entry (root) application module class
     * @param options Optional Nest application configuration
     *
     * @returns A promise that, when resolved,
     * contains a reference to the NestApplicationContext instance.
     */
    async createApplicationContext(module, options) {
        const container = new container_1.NestContainer();
        this.applyLogger(options);
        await this.initialize(module, container);
        const modules = container.getModules().values();
        const root = modules.next().value;
        const context = this.createNestInstance(new nest_application_context_1.NestApplicationContext(container, [], root));
        return context.init();
    }
    createNestInstance(instance) {
        return this.createProxy(instance);
    }
    async initialize(module, container, config = new application_config_1.ApplicationConfig(), httpServer = null) {
        const instanceLoader = new instance_loader_1.InstanceLoader(container);
        const metadataScanner = new metadata_scanner_1.MetadataScanner();
        const dependenciesScanner = new scanner_1.DependenciesScanner(container, metadataScanner, config);
        container.setHttpAdapter(httpServer);
        await (httpServer === null || httpServer === void 0 ? void 0 : httpServer.init());
        try {
            this.logger.log(constants_1.MESSAGES.APPLICATION_START);
            await exceptions_zone_1.ExceptionsZone.asyncRun(async () => {
                await dependenciesScanner.scan(module);
                await instanceLoader.createInstancesOfDependencies();
                dependenciesScanner.applyApplicationProviders();
            });
        }
        catch (e) {
            process.abort();
        }
    }
    createProxy(target) {
        const proxy = this.createExceptionProxy();
        return new Proxy(target, {
            get: proxy,
            set: proxy,
        });
    }
    createExceptionProxy() {
        return (receiver, prop) => {
            if (!(prop in receiver)) {
                return;
            }
            if (shared_utils_1.isFunction(receiver[prop])) {
                return this.createExceptionZone(receiver, prop);
            }
            return receiver[prop];
        };
    }
    createExceptionZone(receiver, prop) {
        return (...args) => {
            let result;
            exceptions_zone_1.ExceptionsZone.run(() => {
                result = receiver[prop](...args);
            });
            return result;
        };
    }
    applyLogger(options) {
        if (!options) {
            return;
        }
        !shared_utils_1.isNil(options.logger) && logger_service_1.Logger.overrideLogger(options.logger);
    }
    createHttpAdapter(httpServer) {
        const { ExpressAdapter } = load_adapter_1.loadAdapter('@nestjs/platform-express', 'HTTP', () => require('@nestjs/platform-express'));
        return new ExpressAdapter(httpServer);
    }
    isHttpServer(serverOrOptions) {
        return !!(serverOrOptions && serverOrOptions.patch);
    }
    createAdapterProxy(app, adapter) {
        return new Proxy(app, {
            get: (receiver, prop) => {
                if (!(prop in receiver) && prop in adapter) {
                    return this.createExceptionZone(adapter, prop);
                }
                return receiver[prop];
            },
        });
    }
}
exports.NestFactoryStatic = NestFactoryStatic;
/**
 * Use NestFactory to create an application instance.
 *
 * ### Specifying an entry module
 *
 * Pass the required *root module* for the application via the module parameter.
 * By convention, it is usually called `ApplicationModule`.  Starting with this
 * module, Nest assembles the dependency graph and begins the process of
 * Dependency Injection and instantiates the classes needed to launch your
 * application.
 *
 * @publicApi
 */
exports.NestFactory = new NestFactoryStatic();
