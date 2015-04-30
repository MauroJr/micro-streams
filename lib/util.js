'use strict';

const util = require('util');

module.exports.parseArgs = parseArgs;
module.exports.uvFail = util._errnoException;
module.exports.dupConstructor = dupConstructor;
module.exports.registerBenchmark = registerBenchmark;
module.exports.runBenchmarks = runBenchmarks;
module.exports.generateOnCallback = generateOnCallback;
module.exports.failSafely = failSafely;

var test_list = [];


// Use for parsing arguments passed after callback.
function parseArgs(args, start) {
  var arr = [];
  for (var i = start; i < args.length; i++)
    arr.push(args[i]);
  return arr;
}


function dupProperty(target, source, key) {
  var prop = Object.getOwnPropertyDescriptor(source, key);

  // Check for getter/setter
  if (prop.get || prop.set)
    Object.defineProperty(target, key, prop);
  else
    target[key] = source[key];
}


// Not fast. Meant to be used once to setup constructors.
function dupConstructor(target, source) {
  var keys, i;

  keys = Object.keys(source);
  for (i = 0; i < keys.length; i++)
    dupProperty(target, source, keys[i]);

  keys = Object.keys(source.prototype);
  for (i = 0; i < keys.length; i++)
    dupProperty(target.prototype, source.prototype, keys[i]);

  // "instanceof" can be easily fooled, so not going to bother with setting
  // the __proto__ of the constructor and its prototype.
}


function registerBenchmark(cb) {
  test_list.push(cb);
}


function runBenchmarks() {
  if (test_list.length > 0) {
    setImmediate(function() {
      test_list.shift()();
      runBenchmarks();
    });
  }
}




// This same template of code is used often to store the default properties
// for the .on*() callbacks.
function generateOnCallback(name) {
  var fn_string = `return function ${name}(cb) {
    var arr;

    if (arguments.length === 0)
      return this._${name}_cb;

    if (cb === null)
      return this._${name}_cb = this._${name}_args = undefined;

    if (typeof cb !== 'function')
      throw new TypeError('callback must be a function');

    this._${name}_cb = cb;
    if (arguments.length > 1) {
      arr = [];
      for (var i = 1; i < arguments.length; i++)
        arr.push(arguments[i]);
      this._${name}_args = arr;
    // Done in case arguments were set for a previous callback.
    } else {
      this._${name}_args = undefined;
    }
  }`;

  return (new Function(fn_string))();
}


function failSafely(ctx, cb, fail) {
  var args = undefined;
  var args_len = arguments.length;
  var failed = true;
  var ret;
  if (args_len > 6)
    args = parseArgs(arguments, 3);
  try {
    if (args_len > 6 || ctx)
      ret = cb.apply(ctx, args);
    if (args_len === 3)
      ret = cb();
    else if (args_len === 4)
      ret = cb(arguments[3]);
    else if (args_len === 5)
      ret = cb(arguments[3], arguments[4]);
    else if (args_len === 6)
      ret = cb(arguments[2], arguments[4], arguments[5]);
    else
      throw new Error('UNREACHABLE');
    failed = false;
  } finally {
    if (failed) {
      if (args_len > 6 || ctx)
        fail.apply(ctx, args);
      if (args_len === 3)
        fail();
      else if (args_len === 4)
        fail(arguments[3]);
      else if (args_len === 5)
        fail(arguments[3], arguments[4]);
      else if (args_len === 6)
        fail(arguments[2], arguments[4], arguments[5]);
      else
        throw new Error('UNREACHABLE');
    }
  }
  return ret;
}
