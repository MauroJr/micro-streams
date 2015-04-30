'use strict';

const util = require('./util.js');

module.exports = Writable;


/**
 */
function WriteReq(data, owner) {
  var ctr = this.constructor;

  /* public */
  this.data = data;
  this.owner = owner;
  /* private */
  this._oncomplete_args = ctr._oncomplete_args;
  this._oncomplete_cb = ctr._oncomplete_cb;
}

WriteReq._oncomplete_args = undefined;
WriteReq._oncomplete_cb = undefined;


/**
 */
WriteReq.oncomplete = util.generateOnCallback('oncomplete');


/**
 * Run this when the write request is completed. Passing an error is optional.
 */
WriteReq.prototype._oncomplete = function _oncomplete(er) {
  var owner = this.owner;
  var wreq;

  // Write request has completed so decrement the counter.
  owner._pending_wreq--;

  // No callback was provided to the write request so call the onerror
  // callback.
  if (typeof this._oncomplete_cb !== 'function') {
    if (er)
      this.owner._onerror_cb.apply(this, this.owner._onerror_args);

  } else {
    if (this._oncomplete_args) {
      if (er)
        this._oncomplete_args.unshift(er);
      this._oncomplete_cb.apply(this, this._oncomplete_args);
    } else {
      if (er)
        this._oncomplete_cb(er);
      else
        this._oncomplete_cb();
    }
  }

  // Proceed immediately to write more data if available.
  if (owner._pending_wreq === 0 && owner._write_req_queue.length > 0) {
    wreq = owner._write_req_queue.shift();
    owner._pending_wreq++;
    owner._tx_val = owner._tx_val + owner._onwrite(wreq);
  }

  // If more can be written call the onwritable callback.
  if (owner._iswritable()) {
    if (owner._onwritable_args)
      owner._onwritable_cb.apply(owner, owner._onwritable_args);
    else
      owner._onwritable_cb();
  }
};


/**
 */
WriteReq.prototype.oncomplete = WriteReq.oncomplete;


/**
 * Usage:
 *    new Writable();
 */
function Writable() {
  // Use this.constructor to get the default values set on any inherited
  // instance.
  var ctr = this.constructor;
  var ptr = ctr.prototype;

  // Initialize properties and use default values.
  this._has_ended = false;
  this._pending_wreq = 0;
  this._tx_val = 0;
  this._write_req_queue = [];

  // Store all the default object properties for callbacks passed to the
  // .on*() methods.
  this._onend_args = ctr._onend_args;
  this._onend_cb = ctr._onend_cb;
  this._onerror_args = ctr._onerror_args;
  this._onerror_cb = ctr._onerror_cb;
  this._onwritable_args = ctr._onwritable_args;
  this._onwritable_cb = ctr._onwritable_cb;

  // Setting all the prototype's ._on*() callbacks in the new instance in case
  // one of them needs to be overridden, and to prevent mutating the object.
  // Use any defaults that have been set on the prototype.
  this._iswritable = ptr._iswritable;
  this._onwrite = ptr._onwrite;
}

Writable._onend_args = undefined;
Writable._onend_cb = undefined;
Writable._onerror_args = undefined;
Writable._onerror_cb = undefined;
Writable._onwritable_args = undefined;
Writable._onwritable_cb = undefined;

/**
 * Exposed so user can override this. As long as it has the same interface
 * then it will work just as well. New WriteReq instances can be made by
 * following the same type of inheritance model that other streams do. It just
 * need to be assigned to the inherited Writable stream like it's done here.
 */
Writable.WriteReq = WriteReq;


/**
 * Usage:
 *    WritableConstructor.onend();
 * OR
 *    WritableConstructor.onend(callback[, ...args]);
 * OR
 *    WritableConstructor.onend(null);
 */
Writable.onend = util.generateOnCallback('onend');


/**
 * Usage:
 *    WritableConstructor.onerror();
 * OR
 *    WritableConstructor.onerror(callback[, ...args]);
 * OR
 *    WritableConstructor.onerror(null);
 */
Writable.onerror = util.generateOnCallback('onerror');


/**
 * Usage:
 *    WritableConstructor.onwritable();
 * OR
 *    WritableConstructor.onwritable(callback[, ...args]);
 * OR
 *    WritableConstructor.onwritable(null);
 */
Writable.onwritable = function onwritable(cb) {
  if (arguments.length === 0)
    return this._onwritable_cb;

  if (cb === null)
    return this._onwritable_cb = this._onwritable_args = undefined;

  if (typeof cb !== 'function')
    throw new TypeError('callback must be a function');

  this._onwritable_cb = cb;
  if (arguments.length > 1) {
    this._onwritable_args = util.parseArgs(1, arguments);
  // Done in case arguments were set for a previous callback.
  } else {
    this._onwritable_args = undefined;
  }

  if (this._iswritable())
    process.nextTick(callOnWritable, this);
}


function callOnWritable(self) {
  // Once last check to make sure nothing has changed.
  if (!self._iswritable())
    return;

  if (self._onwritable_args)
    self._onwritable_cb.apply(self, self._onwritable_args);
  else
    self._onwritable_cb();
}


Writable.prototype.abort = function abort() {
  this._write_req_queue.length = 0;
  this.end();
};


/**
 * Signal to the stream that no more data will be written. If more data is
 * attempted to be written afterwards then either an error will be passed
 * to the callback, if one was passed, or the call will throw.
 * This will not prevent existing data from being written.
 */
Writable.prototype.end = function end() {
  if (this._has_ended)
    return;

  this._has_ended = true;

  if (typeof this._onend_cb !== 'function')
    return;

  if (this._onend_args)
    this._onend_cb.apply(this, this._onend_args);
  else
    this._onend_cb();
};


/**
 */
Writable.prototype.onend = Writable.onend;


/**
 */
Writable.prototype.onerror = Writable.onerror;


/**
 * Usage:
 *    stream.onwritable();
 * OR
 *    stream.onwritable(callback[, ...vargs]);
 * OR
 *    stream.onwritable(null);
 *
 * Be alerted to when more data can be written to the stream.
 */
Writable.prototype.onwritable = Writable.onwritable;


/**
 * Usage:
 *    stream.tx();
 */
Writable.prototype.tx = function tx() {
  return this._tx_val
};


/**
 * Usage:
 *    stream.write(data[, callback[, ...vargs]]);
 */
Writable.prototype.write = function write(data) {
  // Use "this.constructor" to make sure any override is used from an
  // inherited instance.
  var wreq = new this.constructor.WriteReq(data, this);

  if (this._pending_wreq > 0) {
    this._write_req_queue.push(wreq);
    return wreq;
  }

  this._pending_wreq++;
  this._tx_val = this._tx_val + this._onwrite(wreq);
  return wreq;
};


/**
 * Usage:
 *    stream.iswritable();
 */
// Currently this is a guide to help users. Not a hard limit. Should that
// change?
Writable.prototype.iswritable = function iswritable() {
  return this._iswritable();
};


/**
 * Can be implemented.
 */
Writable.prototype._iswritable = function _iswritable_default() {
  return this._write_req_queue.length <= 3;
};


/**
 * Must be implemented.
 *
 * Alerts implementor that there is a request to be written. When the write
 * request has been completed run req._oncomplete().
 *
 * Return a Number which increments the internal counter of how many objects/
 * bytes have been written by the user. Example implementation for byte
 * stream:
 *
 *    Writable.prototype._onwrite = function _onwrite(req) {
 *      return req.data.length;
 *    };
 */
Writable.prototype._onwrite = undefined;
