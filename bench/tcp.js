const tcp = require('../lib/tcp');
const TCPServer = tcp.TCPServer;
const TCPClient = tcp.TCPClient;


// Setup TCPServer //

var server = new TCPServer();

server.onconnection(function onConnection(conn) {
  console.log('onconnection');
  conn.onreadable(onReadable);

  //setTimeout(printRx, 1000, conn, 0, process.hrtime());

  //conn.pause();
  //setTimeout(resume, 1000, conn);
});

server.listen(8080);


function onReadable() {
  console.log(this.queued());
  while (this.isreadable())
    this.read();
    //console.log(this.read());
    //this.write(this.read());

  if (this.rx() > 1024 * 1024 * 1024)
    this.close();
}


//function resume(conn) {
  //console.log('>>> resume');
  //conn.resume();
//}


//function writeComplete() {
  //console.log(this);
//}


//setInterval(function() {
  //console.log(server.rx());
//}, 1000);



//function printRx(conn, bytes, t) {
  //var rx = conn.rx();
  //t = process.hrtime(t);
  //bytes = rx - bytes;
  //console.log((bytes / 1024 / 1024 / (t[0] + t[1] / 1e9)).toFixed(1) + ' MB/sec');
  //if (bytes > 0)
    //setTimeout(printRx, 1000, conn, rx, process.hrtime());
//}
/* */




/*
const net = require('net');

var server = net.createServer(function(conn) {
  conn.rx = 0;
  console.log('onconnection');
  conn.on('readable', onReadable);
  setTimeout(printRx, 1000, conn, 0, process.hrtime());
}).listen(8080);


function onReadable() {
  var data;
  do {
    data = this.read();
    if (data)
      this.rx += data.length;
  } while (data);
}


function printRx(conn, bytes, t) {
  var rx = conn.rx;
  t = process.hrtime(t);
  bytes = rx - bytes;
  console.log((bytes / 1024 / 1024 / (t[0] + t[1] / 1e9)).toFixed(1) + ' MB/sec');
  if (bytes > 0)
    setTimeout(printRx, 1000, conn, rx, process.hrtime());
}
/* */
