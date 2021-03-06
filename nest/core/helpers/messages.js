"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INVALID_EXECUTION_CONTEXT = exports.CONTROLLER_MAPPING_MESSAGE = exports.ROUTE_MAPPED_MESSAGE = exports.MODULE_INIT_MESSAGE = void 0;
const request_method_enum_1 = require("@nestjs/common/enums/request-method.enum");
exports.MODULE_INIT_MESSAGE = (text, module) => `${module} dependencies initialized`;
exports.ROUTE_MAPPED_MESSAGE = (path, method) => `Mapped {${path}, ${request_method_enum_1.RequestMethod[method]}} route`;
exports.CONTROLLER_MAPPING_MESSAGE = (name, path) => `${name} {${path}}:`;
exports.INVALID_EXECUTION_CONTEXT = (methodName, currentContext) => `Calling ${methodName} is not allowed in this context. Your current execution context is "${currentContext}".`;
