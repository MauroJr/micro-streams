'use strict';

const assert = require('assert');
const Readable = require('../lib/readable.js');
const util = require('../lib/util.js');
const log = process._rawDebug;

function MyReadable() {
  Readable.call(this);

  this._amount_queued = 0;
  this._active_check = true;
}
util.dupConstructor(MyReadable, Readable);

/*** Require Implementation ***/

// Required to be implemented because it is the mechanism used to determine
// how to throttle the queue.
MyReadable.prototype._queued = function _queued() {
  return this._amount_queued;
};

/*** Optional Implementation ***/

MyReadable.prototype._isreadable = function _isreadable() {
  return this.queued() > 0;
};

MyReadable.prototype._oncleanup = function _oncleanup(cb) {
  // "cb" must be run when stream cleanup is complete.
  process.nextTick(cb);
};

MyReadable.prototype._onflushed = function _onflushed() {
  // Generally this would be used as a notification mechanism to .push() more
  // data onto the readble queue.
};

MyReadable.prototype._onpause = function _onpause() {
  // Meant mainly for handling system resources.
  this._active_check = false;
};

MyReadable.prototype._onpush = function _onpush(data) {
  if (data)
    this._amount_queued += data.length;
};

MyReadable.prototype._onread = function _onread(data) {
  if (data)
    this._amount_queued -= data.length;
  // Return size of message. This will increment the total value returned by
  // rx().
  return data.length;
};

MyReadable.prototype._onresume = function _onresume() {
  // Not really anything we need to do here. Meant more for when there's an
  // attached system resource that needs to be resumed.
  this._active_check = true;
};


/*** User Usage ***/
MyReadable.onclosed(function() {
  throw new Error('should never be run');
});

MyReadable.onclosing(function(arg) {
  assert(arg === 'foo');
  log('MyReadable.onclosing');
  this.survive();
}, 'foo');

MyReadable.onpipe(function() {
  // Unused
});

var myr_onr_cnt = 0;
MyReadable.onreadable(function() {
  log('MyReadable.onreadable');
  myr_onr_cnt++;
});


var myr = new MyReadable();

// Test that MyReadable.onclosing() is called.
myr.close();

// Remove existing onclosing() callback and set new onclosed() callback.
myr.onclosing(null);
myr.onclosed(function(arg) {
  assert(arg === 'bar');
  log('myr.onclosed');
}, 'bar');

// Test pushing and reading some data from the stream.
myr.push('foo');
myr.push('bar');
assert.equal(myr_onr_cnt, 1);
assert.equal(myr.queued(), 6);
assert.equal(myr.rx(), 0);
assert.equal(myr.isreadable(), true);
assert.equal(myr.read(), 'foo');
assert.equal(myr.isreadable(), true);
assert.equal(myr.read(), 'bar');
assert.equal(myr.isreadable(), false);

assert.equal(myr._active_check, true);
myr.pause();
assert.equal(myr._active_check, false);
assert.throws(function() {
  myr.push('foo');
});
myr.resume();
assert.equal(myr._active_check, true);
