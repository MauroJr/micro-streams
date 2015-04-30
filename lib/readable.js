'use strict';

const util = require('./util.js');

module.exports = Readable;


/**
 * Usage:
 *    new Readable();
 */
function Readable() {
  // Use this.constructor to get the default values set on any inherited
  // instance.
  var ctr = this.constructor;
  var ptr = ctr.prototype;

  // Initialize properties and use default values.
  this._flush_queued = false;
  this._in_onclosing = false;
  this._is_closed = false;
  this._is_paused = false;
  this._pipe_dest = null;
  this._readable_queue = [];
  this._rx_val = 0;

  // Store all the default object properties for callbacks passed to the
  // .on*() methods.
  this._onclosed_args = ctr._onclosed_args;
  this._onclosed_cb = ctr._onclosed_cb;
  this._onclosed_err = undefined;
  this._onclosing_args = ctr._onclosing_args;
  this._onclosing_cb = ctr._onclosing_cb;
  this._onpipe_args = ctr._onpipe_args;
  this._onpipe_cb = ctr._onpipe_cb;
  this._onreadable_args = ctr._onreadable_args;
  this._onreadable_cb = ctr._onreadable_cb;

  // Setting all the prototype's ._on*() callbacks in the new instance in case
  // one of them needs to be overridden, and to prevent mutating the object.
  // Use any defaults that have been set on the prototype.
  this._oncleanup = ptr._oncleanup;
  this._onflushed = ptr._onflushed;
  this._onpause = ptr._onpause;
  this._onpush = ptr._onpush;
  this._onread = ptr._onread;
  this._onresume = ptr._onresume;
}

Readable._onclosed_args = undefined;
Readable._onclosed_cb = undefined;
Readable._onclosing_args = undefined;
Readable._onclosing_cb = undefined;
Readable._onpipe_args = undefined;
Readable._onpipe_cb = undefined;
Readable._onreadable_cb = undefined;
Readable._onreadable_args = undefined;


/**
 * Usage:
 *    StreamConstructor.onclosed();
 * OR
 *    StreamConstructor.onclosed(callback[, ...vargs]);
 * OR
 *    StreamConstructor.onclosed(null);
 *
 * Set a default callback for all new Readable instances. Can be overridden by
 * the new instance .onclosed() method.
 *
 * Note: Important that the call is past-tense. This callback is called after
 * the stream has been closed and all underlying resources have been cleaned.
 */
Readable.onclosed = util.generateOnCallback('onclosed');


/**
 * Usage:
 *    StreamConstructor.onclosing();
 * OR
 *    StreamConstructor.onclosing(callback[, ...vargs]);
 * OR
 *    StreamConstructor.onclosing(null);
 *
 * Set a default callback for all new Readable instances. Can be overridden by
 * the new instance .onclosing() method.
 *
 * Note: Important that the call is past-tense. This callback is called after
 * the stream has been closed and all underlying resources have been cleaned.
 */
Readable.onclosing = util.generateOnCallback('onclosing');


/**
 * Usage:
 *    StreamConstructor.onpipe();
 * OR
 *    StreamConstructor.onpipe(callback[, ...vargs]);
 * OR
 *    StreamConstructor.onpipe(null);
 *
 * Set a default callback for all new Readable instances. Can be overridden by
 * the new instance .onpipe() method.
 *
 * Note: Important that the call is past-tense. This callback is called after
 * the stream has been closed and all underlying resources have been cleaned.
 */
Readable.onpipe = util.generateOnCallback('onpipe');


/**
 * Usage:
 *    StreamConstructor.onreadable();
 * OR
 *    StreamConstructor.onreadable(callback[, ...vargs]);
 * OR
 *    StreamConstructor.onreadable(null);
 *
 * Set a default callback for all new Readable instances. Can be overridden by
 * the new instance .onreadable() method.
 */
Readable.onreadable = util.generateOnCallback('onreadable');


/**
 * Usage:
 *    stream.close([error]);
 *
 * Notify the readable stream there is no longer interest in receiving
 * additional data. Can pass an optional error argument to notify the user the
 * reason no longer need data is because of another issue.
 */
Readable.prototype.close = function close(err) {
  // Has already been closed. No need to continue.
  if (this._is_closed)
    return;

  this._is_closed = true;

  if (err)
    this._onclosed_err = err;

  // Call .onclosing() callback immediately to notify user that .close() has
  // been run. Allow opportunity to run .survive() and keep the stream alive.
  if (typeof this._onclosing_cb === 'function') {
    this._in_onclosing = true;
    if (this._onclosing_args)
      this._onclosing_cb.apply(this, this._onclosing_args);
    else
      this._onclosing_cb();
    this._in_onclosing = false;
  }

  // If the readable queue is empty _and_ the user didn't run .survive() on
  // the stream then initialize closing the stream resources.
  if (this._is_closed && this._readable_queue.length === 0)
    closeStream(this);
};


function closeStream(self) {
  // Notify implementor that things need to be cleaned up now.
  if (typeof self._oncleanup === 'function')
    process.nextTick(onCleanupNT, self);
  // If no notification needs to be made then set the close callback to run on
  // the next loop in case anything must be cleaned up in uv_close().
  else
    setImmediate(onCloseSI, self);
}


// It's up to the implementor to run the passed callback when all resources
// have been cleaned up.
function onCleanupNT(self) {
  self._oncleanup(returnCloseCB(self));
}


// This is _much_ faster than using Function#bind(). Don't love this approach,
// but is a practical way to encapsulate the call for the end-user.
function returnCloseCB(self) {
  return function runCloseCB() {
    setImmediate(onCloseSI, self);
  }
}


// Run the actual onclosed() callback, and remove the pipe if assigned.
function onCloseSI(self) {
  self._pipe_dest = undefined;
  if (typeof self._onclosed_cb === 'function')
    self._onclosed_cb(self._onclosed_err);
}


/**
 * Usage:
 *    stream.onreadable();
 * OR
 *    stream.onreadable(callback[, ...vargs]);
 * OR
 *    stream.onreadable(null);
 *
 * There can only be a single onreadable() callback. Passing a callback will
 * override the previous callback and passed arguments. Passing no callback
 * will return the current callback. Passing null will remove the callback.
 */
Readable.prototype.onreadable = function onreadable(cb) {
  // Return the onreadable callback if nothing is passed.
  if (arguments.length === 0)
    return this._onreadable_cb;

  if (cb === null)
    return this._onreadable_cb = this._onreadable_args = undefined;

  if (typeof cb !== 'function')
    throw new TypeError('callback must be a function');

  this._onreadable_cb = cb;
  if (arguments.length > 1)
    this._onreadable_args = util.parseArgs(arguments, 1);
  // Done in case arguments were set for a previous callback.
  else
    this._onreadable_args = undefined;

  // Check if user implementation registers this as a readable stream.
  if (!this._isreadable())
    return;

  // Check if data had been queued before this callback was set.
  if (this._readable_queue.length > 0)
    callOnreadable(this);
};


function callOnreadable(self) {
  if (self._onreadable_args)
    self._onreadable_cb.apply(self, self._onreadable_args);
  else
    self._onreadable_cb();
}


/**
 * Usage:
 *    stream.isclosed();
 *
 * Return whether the stream is closed.
 */
Readable.prototype.isclosed = function isclosed() {
  return this._is_closed;
};


/**
 * Usage:
 *    stream.ispaused();
 */
Readable.prototype.ispaused = function ispaused() {
  return this._is_paused;
};


/**
 * Usage:
 *    stream.isreadable();
 *
 * Return whether the stream is readable.
 */
Readable.prototype.isreadable = function isreadable() {
  return this._isreadable();
};


/**
 * Usage:
 *    stream.onclosed();
 * OR
 *    stream.onclosed(callback[, ...vargs]);
 * OR
 *    stream.onclosed(null);
 *
 * Can use this for ref counting how many streams are actively reading from the
 * readable stream so the readable stream isn't cleaned up until then...
 *
 * Note: Important that the call is past-tense. This callback is called after
 * the stream has been closed and all underlying resources have been cleaned.
 */
Readable.prototype.onclosed = Readable.onclosed;


/**
 * Usage:
 *    stream.onclosing();
 * OR
 *    stream.onclosing(callback[, ...vargs]);
 * OR
 *    stream.onclosing(null);
 */
Readable.prototype.onclosing = Readable.onclosing;


/**
 * Usage:
 *    stream.onpipe();
 * OR
 *    stream.onpipe(callback[, ...vargs]);
 * OR
 *    stream.onpipe(null);
 */
Readable.prototype.onpipe = Readable.onpipe;


/**
 * Usage:
 *    stream.queued();
 *
 * Return user-defined number remaining in queue.
 */
Readable.prototype.queued = function queued() {
  return this._queued();
};


/**
 * Usage:
 *    stream.pause();
 *
 * Pause the stream.
 */
Readable.prototype.pause = function pause() {
  if (this._is_paused)
    return;
  this._is_paused = true;
  if (typeof this._onpause === 'function')
    this._onpause();
};


/**
 * Usage:
 *    stream.pipe();
 * OR
 *    stream.pipe(writable);
 */
Readable.prototype.pipe = function pipe(writable) {
  if (arguments.length === 0)
    return this._pipe_dest;

  this._pipe_dest = writable;
  if (this._onpipe_cb) {
    if (this._onpipe_args)
      this._onpipe_cb.apply(this, this._onpipe_args);
    else
      this._onpipe_cb();
  }
};


/**
 * Usage:
 *    stream.push(data);
 *
 * Push more data onto the readable stream to be read by user. Let's the user
 * know asynchronously that data is ready to be consumed.
 */
Readable.prototype.push = function push(value) {
  if (this._is_closed)
    return;

  // XXX: Is throwing an exception too much?
  if (this._is_paused)
    throw new Error('attempt to push data to paused readable stream');

  this._readable_queue.push(value);

  if (typeof this._onpush === 'function')
    this._onpush(value);

  if (this._pipe_dest) {
    if (this._pipe_dest.iswritable())
      writeWhenWritable(this, value);
    else
      this._pipe_dest.onwritable(writeWhenWritable, this, value);
    return;
  }

  // Check if user implementation registers this as a readable stream.
  if (!this.isreadable())
    return;

  // If the queue length is > 1 then the onreadable() callback has already
  // been called.
  if (this._readable_queue.length > 1)
    return;

  if (typeof this._onreadable_cb !== 'function')
    this._readable_queue.push(value);
  else
    callOnreadable(this);
};


// Calling .pipe() then .push() any following .onreadable() will miss data
// already sent to the pipe'd writable.
function writeWhenWritable(self, value) {
  self._pipe_dest.write(value);
  // Skips the .isreadable() check.
  // TODO(trevnorris): Logic flaw here. How quickly data is pushed through the
  // pipe should be determined by whether .isreadable() returns true.
  if (typeof self._onreadable_cb === 'function')
    callOnreadable(self);
}


/**
 * Usage:
 *    stream.read();
 *
 * Read a message from the queue. Will return a single value from the internal
 * queue. It's up to the implementor to decide how the data should be
 * segmented for consumption when data is placed in the queue with .push().
 */
Readable.prototype.read = function read() {
  var value;

  // Check if the stream can be read.
  if (!this._isreadable())
    return;

  // If there is a pipe attached, check if it can be written to.
  if (this._pipe_dest && !this._pipe_dest.iswritable())
    return;

  // If _readable_queue is 1 then the queue will be flushed after this call.
  // So if an onflushed callback is defined, and we haven't already queued the
  // onflushed callback to be run, then prime the callback to run in nextTick.
  if (this._readable_queue.length === 1 &&
      typeof this._onflushed === 'function' &&
      !this._flush_queued) {
    // _onflushed() must be done async or could exceed max call stack.
    var self = this;
    // Note: Uncommon case where nesting the function has better performance
    // than hoisting the callback.
    process.nextTick(function onFlushed() {
      self._flush_queued = false;
      // It's possible the user .pushed()'d more data onto the queue since
      // this callback was called. Check first and return early if so.
      if (self._readable_queue.length !== 0)
        return;
      self._onflushed();
    });
    this._flush_queued = true;
  }

  value = this._readable_queue.shift();

  // Allow implementor to keep track of how much data has been read.
  if (typeof this._onread === 'function')
    this._rx_val = this._rx_val + this._onread(value);

  // Check if the stream needs to be cleaned up and closed.
  // Safe to run this before _pipe_dest.write() because clearing it happens
  // on the next loop.
  if (this._is_closed && this._readable_queue.length === 0)
    closeStream(this);

  if (this._pipe_dest)
    this._pipe_dest.write(value);

  return value;
};


/**
 * Usage:
 *    stream.resume();
 *
 * Resume the stream.
 */
Readable.prototype.resume = function resume() {
  if (!this._is_paused)
    return;
  this._is_paused = false;
  if (typeof this._onresume === 'function')
    this._onresume();
};


/**
 * Usage:
 *    stream.rx();
 *
 * Returns number of objects/bytes that have been read. If the user bothered
 * to implement _onread().
 */
Readable.prototype.rx = function rx() {
  return this._rx_val;
};


/**
 * Usage:
 *    stream.survive();
 *
 * In the onclosing() callback run .survive() to tell the stream that resources
 * should not be cleaned up. The readable callback will still continue to
 * operate normally, pending to send data to any new readable or pipe.
 */
Readable.prototype.survive = function survive() {
  if (!this._in_onclosing)
    throw new Error('Can only run .survive() in the onclosing callback');
  this._is_closed = false;
};


/**
 * Usage:
 *    stream.unpipe(writable);
 *
 * First checks if the passed stream matches the writable stream currently
 * being piped to before removing it.
 */
Readable.prototype.unpipe = function unpipe(writable) {
  if (this._pipe_dest === writable)
    this._pipe_dest = undefined;
};


/**
 * Must be implemented.
 *
 * Example implementation for byte streams:
 *
 *    Readable.prototype._queued = function _queued() {
 *      var len = 0;
 *      for (var i = 0; i < this._readable_queue.length; i++)
 *        len += this._readable_queue[i].length;
 *      return len;
 *    };
 *
 * Note: As a performance optimization the implementor can use _onread() and
 * _onpush() to keep track of queued amount.
 */
Readable.prototype._queued = function _queued_default() {
  throw new Error('_queueud() has not been implemented');
};


/**
 * May be implemented.
 *
 * Default implementation for .isreadable().
 */
Readable.prototype._isreadable = function _isreadable_default() {
  return this._readable_queue.length > 0;
};


/**
 * Can be implemented.
 *
 * Default implementation is to not be called. If the method is set then will
 * call _oncleanup() after the underlying source is complete.
 *
 * This callback recieves an argument of a function. Run this function to
 * notify the stream that all user-defined cleanup is complete and the stream
 * can finish closing/call the onclosed() callback. For example:
 *
 *    Readable.prototype._oncleanup = function _oncleanup(cb) {
 *      // First stop reading more data.
 *      this.readStop();
 *      // When the data has been flushed it's alright to close:
 *      this._onflushed = cb;
 *    };
 *
 * Called after the user's onclosed() callback has been closed.
 */
Readable.prototype._oncleanup = undefined;


/**
 * Can be implemented.
 *
 * Be alerted to when the data queue has been flushed of all data. Useful in
 * conjunction with .push() to place more data on the data queue once nothing
 * is left.
 */
Readable.prototype._onflushed = undefined;


/**
 * Can to be implemented.
 *
 * Use to pause the underlying source. Called when user calls .pause().
 */
Readable.prototype._onpause = undefined;


/**
 * Can be implemented.
 *
 * If implemented the callback will be passed the data chunk that was just
 * .push()ed to the data queue. Useful for passive monitoring.
 */
Readable.prototype._onpush = undefined;


/**
 * Can be implemented.
 *
 * Return a Number which increments the internal counter of how many objects/
 * bytes have been read by the user. Example implementation for byte stream:
 *
 *    Readable.prototype._onread = function _onread(data) {
 *      return data.length;
 *    };
 */
Readable.prototype._onread = undefined;


/**
 * Can be implemented.
 *
 * Use to resume the underlying source. Called when user calls .resume().
 */
Readable.prototype._onresume = undefined;
