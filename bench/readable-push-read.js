const Readable = require('../lib/readable.js');
const util = require('../lib/util.js');
const ITER = 1e7;
var t;

function MyReadable() {
  Readable.call(this);

  this._queued_cnt = 0;

  t = process.hrtime();
  this.push(42);
}
util.dupConstructor(MyReadable, Readable);

MyReadable.prototype._onflushed = function _onflushed() {
  this.push(42);
  this.push(42);
};

MyReadable.prototype._onpush = function _onpush(data) {
  this._queued_cnt++;
};

MyReadable.prototype._onread = function _onread(data) {
  this._queued_cnt--;
  return 1;
};

MyReadable.prototype._queued = function _queued() {
  return this._queued_cnt;
};


var mr = new MyReadable();

mr.onclosed(printTime);

mr.onreadable(function onreadable() {
  while (this.isreadable())
    this.read();
  if (this.rx() > ITER)
    this.close();
});


function printTime() {
  t = process.hrtime(t);
  t = t[0] * 1e9 + t[1];
  console.log(`${(t / ITER).toFixed(1)} ns/op`);
}
