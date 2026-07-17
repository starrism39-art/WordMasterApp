// 提供Babel运行时帮助函数的简单实现，以解决微信开发者工具中的编译错误

// 实现常用的Babel runtime helper函数

// arrayWithoutHoles
function _arrayWithoutHoles(arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) {
      arr2[i] = arr[i];
    }
    return arr2;
  }
}

// arrayLikeToArray
function _arrayLikeToArray(arr, len) {
  if (len == null || len > arr.length) len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++) {
    arr2[i] = arr[i];
  }
  return arr2;
}

// iterableToArray
function _iterableToArray(iter) {
  if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
    return Array.from(iter);
  }
}

// nonIterableSpread
function _nonIterableSpread() {
  throw new TypeError("Invalid attempt to spread non-iterable instance.");
}

// nonIterableRest
function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.");
}

// objectSpread
function _objectSpread(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};
    var ownKeys = Object.keys(source);
    if (typeof Object.getOwnPropertySymbols === 'function') {
      ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
        return Object.getOwnPropertyDescriptor(source, sym).enumerable;
      }));
    }
    ownKeys.forEach(function(key) {
      Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
    });
  }
  return target;
}

// objectWithoutProperties
function _objectWithoutProperties(source, excluded) {
  if (source == null) return {};
  var target = _objectWithoutPropertiesLoose(source, excluded);
  var key, i;
  if (Object.getOwnPropertySymbols) {
    var sourceSymbolKeys = Object.getOwnPropertySymbols(source);
    for (i = 0; i < sourceSymbolKeys.length; i++) {
      key = sourceSymbolKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
      target[key] = source[key];
    }
  }
  return target;
}

function _objectWithoutPropertiesLoose(source, excluded) {
  if (source == null) return {};
  var target = {};
  var sourceKeys = Object.keys(source);
  var key, i;
  for (i = 0; i < sourceKeys.length; i++) {
    key = sourceKeys[i];
    if (excluded.indexOf(key) >= 0) continue;
    target[key] = source[key];
  }
  return target;
}

// 确保这些函数在全局可访问
if (typeof global !== 'undefined') {
  global._arrayWithoutHoles = _arrayWithoutHoles;
  global._arrayLikeToArray = _arrayLikeToArray;
  global._iterableToArray = _iterableToArray;
  global._nonIterableSpread = _nonIterableSpread;
  global._nonIterableRest = _nonIterableRest;
  global._objectSpread = _objectSpread;
  global._objectWithoutProperties = _objectWithoutProperties;
  global._objectWithoutPropertiesLoose = _objectWithoutPropertiesLoose;
}

if (typeof window !== 'undefined') {
  window._arrayWithoutHoles = _arrayWithoutHoles;
  window._arrayLikeToArray = _arrayLikeToArray;
  window._iterableToArray = _iterableToArray;
  window._nonIterableSpread = _nonIterableSpread;
  window._nonIterableRest = _nonIterableRest;
  window._objectSpread = _objectSpread;
  window._objectWithoutProperties = _objectWithoutProperties;
  window._objectWithoutPropertiesLoose = _objectWithoutPropertiesLoose;
}

// 以微信小程序可以识别的方式导出这些Babel运行时帮助函数
// 解决 "module '@babel/runtime/helpers/arrayWithoutHoles.js' is not defined" 错误
module.exports = {
  _arrayWithoutHoles: _arrayWithoutHoles,
  _arrayLikeToArray: _arrayLikeToArray,
  _iterableToArray: _iterableToArray,
  _nonIterableSpread: _nonIterableSpread,
  _nonIterableRest: _nonIterableRest,
  _objectSpread: _objectSpread,
  _objectWithoutProperties: _objectWithoutProperties,
  _objectWithoutPropertiesLoose: _objectWithoutPropertiesLoose
};
