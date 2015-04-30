const Readable = require('../lib/readable');
const Writable = require('../lib/writable');
const util = require('../lib/util');
const ITER = 1e7;
var t;

function MyReadable() {
  Readable.call(this);
}
util.dupConstructor(MyReadable, Readable);

util.registerBenchmark(function readableBench() {
  t = process.hrtime();
  for (var i = 0; i < ITER; i++)
    new MyReadable();
  printTime('Readable');
});


function MyWritable() {
  Writable.call(this);
}
util.dupConstructor(MyWritable, Writable);

util.registerBenchmark(function readableBench() {
  t = process.hrtime();
  for (var i = 0; i < ITER; i++)
    new MyWritable();
  printTime('Writable');
});



util.runBenchmarks();

function printTime(msg) {
  t = process.hrtime(t);
  t = t[0] * 1e9 + t[1];
  console.log(`${msg}: ${(t / ITER).toFixed(1)} ns/op`);
}
