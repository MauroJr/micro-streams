'use strict';

const TCP = process.binding('tcp_wrap').TCP;
const TCPConnectWrap = process.binding('tcp_wrap').TCPConnectWrap;
const WriteWrap = process.binding('stream_wrap').WriteWrap;
const uv = process.binding('uv');
const Readable = require('./readable.js');
const Writable = require('./writable.js');
const util = require('./util.js');

var tcp_rx_val = 0;
var tcp_tx_val = 0;

module.exports.TCPServer = TCPServer;
module.exports.TCPClient = TCPClient;


function OnConnectionReq(args) {
  this.cb = args[0];
  this.args = util.parseArgs(args, 1);
}


function TCPServer() {
  this.port = null;
  this.hostname = null;
  this.type = null;
  this._tx_val = 0;
  this._rx_val = 0;
  this._handle = new TCP();
  this._clients = new Set();
  this._onconnection_req = undefined;

  this._handle.owner = this;
}


TCPServer.rx = function rx() {
  return tcp_rx_val;
};


TCPServer.tx = function tx() {
  return tcp_tx_val;
};


TCPServer.prototype.close = function close() {
  // TODO ([callback[, ...vargs]])
  // Iterate through the list of open client handles and close each of them.
  // the server probably shouldn't close until all client handles have closed.
};


TCPServer.prototype.listen = function listen(port, hostname, backlog) {
  var err;

  // TODO: accept a callback so errors can propagate that way instead of
  // needing to throw.
  if (port >>> 0 !== port)
    throw new TypeError('port must be uint');
  else
    port >>>= 0;

  // TODO error checking on bad hostname/backlog?
  if (arguments.length === 1) {
    hostname = '0.0.0.0';
    backlog = 511;
  } else if (arguments.length === 2) {
    if (typeof hostname === 'number') {
      backlog = hostname;
      // TODO(trevnorris): IPv6 support.
      hostname = '0.0.0.0';
    } else {
      backlog = 511;
    }
  }

  this.port = port;
  this.hostname = hostname;
  this.type = 'ipv4';

  err = this._handle.bind(hostname, port);
  if (err)
    util.uvFail(err, 'bind');
  err = this._handle.listen(backlog);
  if (err)
    util.uvFail(err, 'listen');

  this._handle.onconnection = onConnection;
};


function onConnection(err, clientHandle) {
  var client, c_req, args;

  if (err)
    util.uvFail(err, 'connect');

  client = new TCPClient();
  client._handle = clientHandle;
  client._server = this.owner;
  clientHandle.owner = client;
  clientHandle.onread = onRead;

  client._server._clients.add(client);

  // Call the onconnection() callback.
  c_req = this.owner._onconnection_req;
  if (Array.isArray(c_req.args)) {
    c_req.args.unshift(client);
    c_req.cb.apply(this.owner, c_req.args);
  } else {
    c_req.cb.call(this.owner, client);
  }

  // Check if .pause() was run in the onconnection() cb.
  if (!client._paused)
    clientHandle.readStart();
}


function onRead(nread, buffer) {
  if (nread === 0)
    return;

  if (nread < 0) {
    // TODO implement proper error handling.
    if (nread !== uv.UV_EOF)
      throw new Error('nread < 0 ' + nread);

    // TODO implement end of stream w/o closing the connection.
    return;
  }

  this.owner.push(buffer);

  // Each connection can queue up to 128KB of data.
  if (this.owner.queued() > 1024 * 128)
    this.owner.pause();
}


TCPServer.prototype.onconnection = function onconnection() {
  this._onconnection_req = new OnConnectionReq(arguments);
};


TCPServer.prototype.lsoc = function lsoc() {
  // TODO make sure to add/remove connections as they are created/closed. this
  return this._clients.values();
};


TCPServer.prototype.rx = function rx() {
  return this._rx_val;
};


TCPServer.prototype.tx = function tx() {
  return this._tx_val;
};




function TCPClient() {
  Readable.call(this);
  Writable.call(this);

  this._handle = null;
  this._server = null;
  this._queued_data_val = 0;
  this._paused = false;
}
util.dupConstructor(TCPClient, Readable);
util.dupConstructor(TCPClient, Writable);


TCPClient.prototype._cleanup = function _cleanup() {
  // TODO(trevnorris): close the handle and let the server know.
  this._server._clients.delete(this);
};


TCPClient.prototype._onpause = function _onpause() {
  var err;
  if (this._paused)
    return;
  err = this._handle.readStop();
  if (err)
    throw util.uvFail(err, 'readStop');
  this._paused = true;
};


TCPClient.prototype._onpush = function _onpush(data) {
  if (data)
    this._queued_data_val += data.length;
};


TCPClient.prototype._onresume = function _onresume() {
  var err;
  if (!this._paused)
    return;
  err = this._handle.readStart();
  if (err)
    throw util.uvFail(err, 'readStart');
  this._paused = false;
};


TCPClient.prototype._queued = function _queued() {
  return this._queued_data_val;
};


TCPClient.prototype._onread = function _onread(data) {
  if (!data)
    return 0;
  tcp_rx_val += data.length;
  this._server._rx_val += data.length;
  this._queued_data_val -= data.length;
  return data.length;
};


TCPClient.prototype._tx = function _tx(data) {
  if (!data)
    return 0;
  tcp_tx_val += data.length;
  this._server._tx_val += data.length;
  return data.length;
};


TCPClient.prototype._onflushed = function _onflushed() {
  this._handle.readStart();
};


// sreq is the streams request to make sure things propagate
TCPClient.prototype._onwrite = function _onwrite(data, sreq) {
  var req = new WriteWrap();
  req.oncomplete = onWriteComplete;
  req.async = true;
  req.sreq = sreq;
  // TODO(trevnorris): handle return errors from writing.
  this._handle.writev(req, [data, 'buffer']);
  // TODO this seems to write out sync, but need to check the error return
  // value.
  //this._handle.writeBuffer(req, data);
  // TODO will need to keep an internal buffer
};


function onWriteComplete(status, handle, req, err) {
  handle.owner._oncomplete(handle.owner, req.sreq);
  // TODO call the callback provided by the user, if there's one.
}
