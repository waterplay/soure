"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MICROSERVICES_PACKAGE_NOT_FOUND_EXCEPTION = exports.INVALID_EXCEPTION_FILTER = exports.UNHANDLED_RUNTIME_EXCEPTION = exports.UNKNOWN_REQUEST_MAPPING = exports.INVALID_MIDDLEWARE_CONFIGURATION = exports.INVALID_CLASS_SCOPE_MESSAGE = exports.INVALID_CLASS_MESSAGE = exports.UNKNOWN_EXPORT_MESSAGE = exports.UNDEFINED_MODULE_MESSAGE = exports.INVALID_MODULE_MESSAGE = exports.UNDEFINED_FORWARDREF_MESSAGE = exports.INVALID_MIDDLEWARE_MESSAGE = exports.UNKNOWN_DEPENDENCIES_MESSAGE = void 0;
const shared_utils_1 = require("@nestjs/common/utils/shared.utils");
/**
 * Returns the name of an instance
 * @param instance The instance which should get the name from
 */
const getInstanceName = (instance) => instance && instance.name;
/**
 * Returns the name of the dependency
 * Tries to get the class name, otherwise the string value
 * (= injection token). As fallback it returns '+'
 * @param dependency The dependency whichs name should get displayed
 */
const getDependencyName = (dependency) => 
// use class name
getInstanceName(dependency) ||
    // use injection token (symbol)
    (shared_utils_1.isSymbol(dependency) && dependency.toString()) ||
    // use string directly
    dependency ||
    // otherwise
    '+';
/**
 * Returns the name of the module
 * Tries to get the class name. As fallback it returns 'current'.
 * @param module The module which should get displayed
 */
const getModuleName = (module) => (module && getInstanceName(module.metatype)) || 'current';
const stringifyScope = (scope) => (scope || []).map(getInstanceName).join(' -> ');
exports.UNKNOWN_DEPENDENCIES_MESSAGE = (type, unknownDependencyContext, module) => {
    const { index, name = 'dependency', dependencies, key, } = unknownDependencyContext;
    const moduleName = getModuleName(module) || 'Module';
    const dependencyName = getDependencyName(name);
    let message = `Nest can't resolve dependencies of the ${type.toString()}`;
    const potentialSolutions = `\n
Potential solutions:
- If ${dependencyName} is a provider, is it part of the current ${moduleName}?
- If ${dependencyName} is exported from a separate @Module, is that module imported within ${moduleName}?
  @Module({
    imports: [ /* the Module containing ${dependencyName} */ ]
  })
`;
    if (shared_utils_1.isNil(index)) {
        message += `. Please make sure that the "${key.toString()}" property is available in the current context.${potentialSolutions}`;
        return message;
    }
    const dependenciesName = (dependencies || []).map(getDependencyName);
    dependenciesName[index] = '?';
    message += ` (`;
    message += dependenciesName.join(', ');
    message += `). Please make sure that the argument ${dependencyName} at index [${index}] is available in the ${getModuleName(module)} context.`;
    message += potentialSolutions;
    return message;
};
exports.INVALID_MIDDLEWARE_MESSAGE = (text, name) => `The middleware doesn't provide the 'use' method (${name})`;
exports.UNDEFINED_FORWARDREF_MESSAGE = (scope) => `Nest cannot create the module instance. Often, this is because of a circular dependency between modules. Use forwardRef() to avoid it.

(Read more: https://docs.nestjs.com/fundamentals/circular-dependency)
Scope [${stringifyScope(scope)}]
  `;
exports.INVALID_MODULE_MESSAGE = (parentModule, index, scope) => {
    const parentModuleName = (parentModule === null || parentModule === void 0 ? void 0 : parentModule.name) || 'module';
    return `Nest cannot create the ${parentModuleName} instance.
Received an unexpected value at index [${index}] of the ${parentModuleName} "imports" array. 

Scope [${stringifyScope(scope)}]`;
};
exports.UNDEFINED_MODULE_MESSAGE = (parentModule, index, scope) => {
    const parentModuleName = (parentModule === null || parentModule === void 0 ? void 0 : parentModule.name) || 'module';
    return `Nest cannot create the ${parentModuleName} instance.
The module at index [${index}] of the ${parentModuleName} "imports" array is undefined.

Potential causes:
- A circular dependency between modules. Use forwardRef() to avoid it. Read more: https://docs.nestjs.com/fundamentals/circular-dependency
- The module at index [${index}] is of type "undefined". Check your import statements and the type of the module.

Scope [${stringifyScope(scope)}]`;
};
exports.UNKNOWN_EXPORT_MESSAGE = (token = 'item', module) => {
    token = shared_utils_1.isSymbol(token) ? token.toString() : token;
    return `Nest cannot export a provider/module that is not a part of the currently processed module (${module}). Please verify whether the exported ${token} is available in this particular context.

Possible Solutions:
- Is ${token} part of the relevant providers/imports within ${module}?
`;
};
exports.INVALID_CLASS_MESSAGE = (text, value) => `ModuleRef cannot instantiate class (${value} is not constructable).`;
exports.INVALID_CLASS_SCOPE_MESSAGE = (text, name) => `${name || 'This class'} is marked as a scoped provider. Request and transient-scoped providers can't be used in combination with "get()" method. Please, use "resolve()" instead.`;
exports.INVALID_MIDDLEWARE_CONFIGURATION = `An invalid middleware configuration has been passed inside the module 'configure()' method.`;
exports.UNKNOWN_REQUEST_MAPPING = `An invalid controller has been detected. Perhaps, one of your controllers is missing @Controller() decorator.`;
exports.UNHANDLED_RUNTIME_EXCEPTION = `Unhandled Runtime Exception.`;
exports.INVALID_EXCEPTION_FILTER = `Invalid exception filters (@UseFilters()).`;
exports.MICROSERVICES_PACKAGE_NOT_FOUND_EXCEPTION = `Unable to load @nestjs/microservices package. (Please make sure that it's already installed.)`;
