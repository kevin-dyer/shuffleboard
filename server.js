const express = require('express');
const http = require('http');
const url = require('url');
var path = require('path');
// const WebSocket = require('ws');

var io = require('socket.io');
var allowedOrigins = "http://localhost:* http://127.0.0.1:*";

const app = express();
const server = http.createServer(app);
// const wss = new WebSocket.Server({ server });

var sio_server = io(server, {
    origins: allowedOrigins,
    // path : '/',
    transports: [
      'websocket', 
      'flashsocket', 
      'htmlfile', 
      'xhr-polling', 
      'jsonp-polling', 
      'polling'
    ]
});

app.use(express.static(path.join(__dirname + '/build/client')));

app.get('*', (req, res) => {
  console.log("get index.html!")
  res.sendFile(path.join(__dirname + '/app/build/client/index.html'));
});


//TODO: need to emit when user disconnects
let userCount = 0
sio_server.on('connection', function(socket){
  socket.broadcast.emit('USER_JOINED', {userCount: ++userCount});
  socket.emit('USER_JOINED', {userCount: userCount});
  console.log('a user connected, userCount: ', userCount);

  socket.on('BROADCAST_BOARD_CONFIG', function(msg) {

    // console.log("broadcast board config msg: ", msg)
    socket.broadcast.emit('BROADCAST_BOARD_CONFIG', msg);
  })

  socket.on('BROADCAST_PUCKS', function(msg) {
    socket.broadcast.emit('BROADCAST_PUCKS', msg);
  })

  socket.on('disconnect', function (reason) {
    // socket.broadcast.emit('USER_LEFT', {userCount: --userCount});
    userCount = 0
    socket.broadcast.emit('USER_LEFT', {userCount: userCount});
    console.log('a user DISconnected, userCount: ', userCount);
  })
});

server.listen(8080, function listening() {
  console.log('Listening on %d', server.address().port);
  console.log('address: ', server.address());
});