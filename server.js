const express = require('express');
const http = require('http');
const url = require('url');
var path = require('path');
// const WebSocket = require('ws');

var io = require('socket.io');
// var allowedOrigins = "http://localhost:* http://127.0.0.1:* http://0.0.0.0:* http://192.168.0.101:*";

const app = express();
const server = http.createServer(app);
// const wss = new WebSocket.Server({ server });

var sio_server = io(server, {
    // origins: allowedOrigins,
    // path : '/',
    // transports: [
    //   'websocket', 
    //   'flashsocket', 
    //   'htmlfile', 
    //   'xhr-polling', 
    //   'jsonp-polling', 
    //   'polling'
    // ]
});

const BROADCAST_BOARD_CONFIG = 'BROADCAST_BOARD_CONFIG'
const USER_JOINED = 'USER_JOINED'
const USER_LEFT = 'USER_LEFT'
const START_GAME = 'START_GAME'
const ROOM_CREATED = 'ROOM_CREATED'
const JOIN_GAME = 'JOIN_GAME'
const LEAVE_GAME = 'LEAVE_GAME'
const BROADCAST_PUCKS = 'BROADCAST_PUCKS'
const TURN_HAS_STARTED = 'TURN_HAS_STARTED'
const MOUSE_DOWN = 'MOUSE_DOWN'
const MOUSE_UP = 'MOUSE_UP'
const ACCEPT_MODAL = 'ACCEPT_MODAL'
const JOINED_ROOM = 'JOINED_ROOM'
const GAME_STARTED = 'GAME_STARTED'


app.use(express.static(path.join(__dirname + '/build/client')));

app.get('*', (req, res) => {
  console.log("get index.html!")
  res.sendFile(path.join(__dirname + '/build/client/index.html'));
});

//this seems like over kill becuase I will be setting up a new socket for each room
// and it does not seem like it can be towrn down 
//TODO: create endpoint to create channels for
// let roomPin = 1000
// app.get('/start_game', (req, res) => {
//   //TODO: create namespaced channel, for now, make the channel name space the pin
//   // const pin = Math.floor(Math.random() * 1000 + 1000) % 10000 //this should always have 4 digits

//   console.log("pin: ", pin)

//   //create namespaced socket
//   const room = io.of(`/room${pin}`);

//   room.on('connection', function(socket){
//     console.log('someone connected');
    
//   });
// })

function broadcastMsg(socket, type, msg={}) {
  const nextMsg = msg
  const roomId = msg && msg.roomId
  delete nextMsg.roomId
  
  if (roomId) {
    socket.to(roomId).broadcast.emit(type, nextMsg)
  }
}


//TODO: need to emit when user disconnects
let userCount = 0
let roomPin = 1000
sio_server.on('connection', function(socket){
  socket.broadcast.emit(USER_JOINED, {socketId: socket.id});
  console.log('User connected, socketId: ', socket.id);

  //join room
  //TODO: figure out how to clean up old rooms
  //Question, are these the correct arguments?
  socket.on(START_GAME, function(id, msg) {
    //create new roomId
    const roomId = `room${++roomPin}`
    socket.join(roomId)

    console.log("start_game called, roomPin: ", roomPin, ", roomId: ", roomId)

    sio_server.in(roomId).clients((error, clients) => {
      if (error) throw error;

      socket.emit(GAME_STARTED, {roomId, roomPin, clients})
    })

    //reset pin if maxes out
    if (roomPin >= 10000) {
      roomPin = 1000
    }
  })

  socket.on(JOIN_GAME, function (msg) {
    if (msg && msg.roomPin) {
      const roomId = `room${msg.roomPin}`

      console.log("JOIN_GAME roomId: ", roomId)
      socket.join(roomId)

      sio_server.in(roomId).clients((error, clients) => {
        if (error) throw error;
        socket.emit(JOINED_ROOM, {roomId, roomPin, clients})
      })
      //return roomId to specific client
      broadcastMsg(socket, USER_JOINED, {roomId, socketId: socket.id})
    }
  })

  //I dont think i need this
  //This should get called when no more users in room
  //will be difficult to tell when users leave rooms
  socket.on(LEAVE_GAME, function(msg) {
    if (msg && msg.roomId) {
      socket.leave(msg.roomId)
    }
  })

  socket.on(BROADCAST_BOARD_CONFIG, msg =>
    broadcastMsg(socket, BROADCAST_BOARD_CONFIG, msg)
  )

  socket.on(BROADCAST_PUCKS, msg =>
    broadcastMsg(socket, BROADCAST_PUCKS, msg)
  )

  socket.on(TURN_HAS_STARTED, msg =>
    broadcastMsg(socket, TURN_HAS_STARTED, msg)
  )

  socket.on(MOUSE_DOWN, msg =>
    broadcastMsg(socket, MOUSE_DOWN, msg)
  )

  socket.on(MOUSE_UP, msg =>
    broadcastMsg(socket, MOUSE_UP, msg)
  )

  socket.on(ACCEPT_MODAL, msg =>
    broadcastMsg(socket, ACCEPT_MODAL, msg)
  )

  socket.on('disconnect', function (reason) {
    const rooms = Object  .keys(socket.rooms)

    //TODO: for each room, need to broadcast that user left
    //NOTE: should only be one room
    rooms.forEach(roomId => {
      const clients = io.sockets.clients(roomId)

      if (clients && clients.length > 0) {
        broadcastMsg(socket, USER_LEFT, {roomId, socketId: socket.id})
      } else {
        //No one left in this room
        console.log("all clients have left the room: ", roomId)
      }
    })
  })
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, function listening() {
  console.log('Listening on %d', server.address().port);
  console.log('address: ', server.address());
});