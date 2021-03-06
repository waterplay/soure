"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpressAdapter = void 0;
const shared_utils_1 = require("@nestjs/common/utils/shared.utils");
const http_adapter_1 = require("@nestjs/core/adapters/http-adapter");
const router_method_factory_1 = require("@nestjs/core/helpers/router-method-factory");
const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");
const http = require("http");
const https = require("https");
class ExpressAdapter extends http_adapter_1.AbstractHttpAdapter {
    constructor(instance) {
        super(instance || express());
        this.routerMethodFactory = new router_method_factory_1.RouterMethodFactory();
    }
    reply(response, body, statusCode) {
        if (statusCode) {
            response.status(statusCode);
        }
        if (shared_utils_1.isNil(body)) {
            return response.send();
        }
        return shared_utils_1.isObject(body) ? response.json(body) : response.send(String(body));
    }
    status(response, statusCode) {
        return response.status(statusCode);
    }
    render(response, view, options) {
        return response.render(view, options);
    }
    redirect(response, statusCode, url) {
        return response.redirect(statusCode, url);
    }
    setErrorHandler(handler, prefix) {
        return this.use(handler);
    }
    setNotFoundHandler(handler, prefix) {
        return this.use(handler);
    }
    setHeader(response, name, value) {
        return response.set(name, value);
    }
    listen(port, ...args) {
        return this.httpServer.listen(port, ...args);
    }
    close() {
        if (!this.httpServer) {
            return undefined;
        }
        return new Promise(resolve => this.httpServer.close(resolve));
    }
    set(...args) {
        return this.instance.set(...args);
    }
    enable(...args) {
        return this.instance.enable(...args);
    }
    disable(...args) {
        return this.instance.disable(...args);
    }
    engine(...args) {
        return this.instance.engine(...args);
    }
    useStaticAssets(path, options) {
        if (options && options.prefix) {
            return this.use(options.prefix, express.static(path, options));
        }
        return this.use(express.static(path, options));
    }
    setBaseViewsDir(path) {
        return this.set('views', path);
    }
    setViewEngine(engine) {
        return this.set('view engine', engine);
    }
    getRequestHostname(request) {
        return request.hostname;
    }
    getRequestMethod(request) {
        return request.method;
    }
    getRequestUrl(request) {
        return request.originalUrl;
    }
    enableCors(options) {
        return this.use(cors(options));
    }
    createMiddlewareFactory(requestMethod) {
        return this.routerMethodFactory
            .get(this.instance, requestMethod)
            .bind(this.instance);
    }
    initHttpServer(options) {
        const isHttpsEnabled = options && options.httpsOptions;
        if (isHttpsEnabled) {
            this.httpServer = https.createServer(options.httpsOptions, this.getInstance());
            return;
        }
        this.httpServer = http.createServer(this.getInstance());
    }
    registerParserMiddleware() {
        const parserMiddleware = {
            jsonParser: bodyParser.json(),
            urlencodedParser: bodyParser.urlencoded({ extended: true }),
        };
        Object.keys(parserMiddleware)
            .filter(parser => !this.isMiddlewareApplied(parser))
            .forEach(parserKey => this.use(parserMiddleware[parserKey]));
    }
    getType() {
        return 'express';
    }
    isMiddlewareApplied(name) {
        const app = this.getInstance();
        return (!!app._router &&
            !!app._router.stack &&
            shared_utils_1.isFunction(app._router.stack.filter) &&
            app._router.stack.some((layer) => layer && layer.handle && layer.handle.name === name));
    }
}
exports.ExpressAdapter = ExpressAdapter;
