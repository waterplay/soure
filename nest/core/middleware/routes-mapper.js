"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoutesMapper = void 0;
const common_1 = require("@nestjs/common");
const constants_1 = require("@nestjs/common/constants");
const shared_utils_1 = require("@nestjs/common/utils/shared.utils");
const metadata_scanner_1 = require("../metadata-scanner");
const router_explorer_1 = require("../router/router-explorer");
class RoutesMapper {
    constructor(container) {
        this.routerExplorer = new router_explorer_1.RouterExplorer(new metadata_scanner_1.MetadataScanner(), container);
    }
    mapRouteToRouteInfo(route) {
        if (shared_utils_1.isString(route)) {
            return [
                {
                    path: this.validateRoutePath(route),
                    method: common_1.RequestMethod.ALL,
                },
            ];
        }
        const routePath = Reflect.getMetadata(constants_1.PATH_METADATA, route);
        if (this.isRouteInfo(routePath, route)) {
            return [
                {
                    path: this.validateRoutePath(route.path),
                    method: route.method,
                },
            ];
        }
        const paths = this.routerExplorer.scanForPaths(Object.create(route), route.prototype);
        const concatPaths = (acc, currentValue) => acc.concat(currentValue);
        return paths
            .map(item => item.path &&
            item.path.map(p => ({
                path: this.validateGlobalPath(routePath) + this.validateRoutePath(p),
                method: item.requestMethod,
            })))
            .reduce(concatPaths, []);
    }
    isRouteInfo(path, objectOrClass) {
        return shared_utils_1.isUndefined(path);
    }
    validateGlobalPath(path) {
        const prefix = shared_utils_1.validatePath(path);
        return prefix === '/' ? '' : prefix;
    }
    validateRoutePath(path) {
        return shared_utils_1.validatePath(path);
    }
}
exports.RoutesMapper = RoutesMapper;
