'use strict';

const assert = require('assert');
const Writable = require('../lib/writable.js');
const util = require('../lib/util.js');
const log = process._rawDebug;


function MyWritable() {
  Writable.call(this);
}
util.dupConstructor(MyWritable, Writable);


/*** Require Implementation ***/

MyWritable.prototype._onwrite = function _onwrite(wreq) {
  process.nextTick(makeWrite, wreq);
  return wreq.data.length;
};

function makeWrite(wreq) {
  wreq._oncomplete();
}





var mw = new MyWritable();

mw.onwritable(function() {
  if (this.tx() < 6)
    this.write('42').oncomplete(writeComplete);
});

function writeComplete() {
  log(this);
}
