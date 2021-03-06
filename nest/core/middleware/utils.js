"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRouteExcluded = exports.assignToken = exports.isClass = exports.mapToClass = exports.filterMiddleware = void 0;
/* eslint-disable @typescript-eslint/no-use-before-define */
const common_1 = require("@nestjs/common");
const shared_utils_1 = require("@nestjs/common/utils/shared.utils");
const pathToRegexp = require("path-to-regexp");
const uuid_1 = require("uuid");
const iterare_1 = require("iterare");
exports.filterMiddleware = (middleware, excludedRoutes, httpAdapter) => {
    const excluded = excludedRoutes.map(route => (Object.assign(Object.assign({}, route), { regex: pathToRegexp(route.path) })));
    return iterare_1.iterate([])
        .concat(middleware)
        .filter(shared_utils_1.isFunction)
        .map((item) => exports.mapToClass(item, excluded, httpAdapter))
        .toArray();
};
exports.mapToClass = (middleware, excludedRoutes, httpAdapter) => {
    if (isClass(middleware)) {
        if (excludedRoutes.length <= 0) {
            return middleware;
        }
        const MiddlewareHost = class extends middleware {
            use(...params) {
                const [req, _, next] = params;
                const isExcluded = isRouteExcluded(req, excludedRoutes, httpAdapter);
                if (isExcluded) {
                    return next();
                }
                return super.use(...params);
            }
        };
        return assignToken(MiddlewareHost, middleware.name);
    }
    return assignToken(class {
        constructor() {
            this.use = (...params) => {
                const [req, _, next] = params;
                const isExcluded = isRouteExcluded(req, excludedRoutes, httpAdapter);
                if (isExcluded) {
                    return next();
                }
                return middleware(...params);
            };
        }
    });
};
function isClass(middleware) {
    return middleware.toString().substring(0, 5) === 'class';
}
exports.isClass = isClass;
function assignToken(metatype, token = uuid_1.v4()) {
    Object.defineProperty(metatype, 'name', { value: token });
    return metatype;
}
exports.assignToken = assignToken;
function isRouteExcluded(req, excludedRoutes, httpAdapter) {
    if (excludedRoutes.length <= 0) {
        return false;
    }
    const reqMethod = httpAdapter.getRequestMethod(req);
    const originalUrl = httpAdapter.getRequestUrl(req);
    const queryParamsIndex = originalUrl && originalUrl.indexOf('?');
    const pathname = queryParamsIndex >= 0
        ? originalUrl.slice(0, queryParamsIndex)
        : originalUrl;
    const isExcluded = excludedRoutes.some(({ method, regex }) => {
        if (common_1.RequestMethod.ALL === method || common_1.RequestMethod[method] === reqMethod) {
            return regex.exec(pathname);
        }
        return false;
    });
    return isExcluded;
}
exports.isRouteExcluded = isRouteExcluded;
