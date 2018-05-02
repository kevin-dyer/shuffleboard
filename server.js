const express = require('express');
const http = require('http');
const url = require('url');
var path = require('path');

var io = require('socket.io');
// var allowedOrigins = "http://localhost:* http://127.0.0.1:* http://0.0.0.0:* http://192.168.0.101:*";

const app = express();
const server = http.createServer(app);

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
const DONE_WAITING = 'DONE_WAITING'
const PLAY_AGAIN = 'PLAY_AGAIN'
const EXIT_GAME = 'EXIT_GAME'
const STOP_TURN = 'STOP_TURN'
const PUCK_BROADCAST_COMPLETE = 'PUCK_BROADCAST_COMPLETE'

app.use(express.static(path.join(__dirname + '/build/client')));

app.get('*', (req, res) => {
  console.log("get index.html!")
  res.sendFile(path.join(__dirname + '/build/client/index.html'));
});


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
  console.log('User connected, socketId: ', socket.id);

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

  socket.on(BROADCAST_BOARD_CONFIG, msg =>{
    //broadcast to all other clients
    broadcastMsg(socket, BROADCAST_BOARD_CONFIG, msg)
    //also emit back to socket
    socket.emit(BROADCAST_BOARD_CONFIG, msg)
  })

  socket.on(BROADCAST_PUCKS, msg =>{
    broadcastMsg(socket, BROADCAST_PUCKS, msg)

    //Return a response to the sender after all messages have been broadcast to clients
    //For testing only
    socket.emit(PUCK_BROADCAST_COMPLETE, {response: 'OK'})
  })

  socket.on(TURN_HAS_STARTED, msg =>
    broadcastMsg(socket, TURN_HAS_STARTED, msg)
  )

  socket.on(MOUSE_DOWN, msg =>
    broadcastMsg(socket, MOUSE_DOWN, msg)
  )

  socket.on(MOUSE_UP, msg =>
    broadcastMsg(socket, MOUSE_UP, msg)
  )

  socket.on(ACCEPT_MODAL, msg => {
    console.log("received ACCEPT_MODAL")
    broadcastMsg(socket, ACCEPT_MODAL, msg)
  })

  socket.on(DONE_WAITING, msg =>
    broadcastMsg(socket, DONE_WAITING, msg)
  )

  socket.on(PLAY_AGAIN, msg =>
    broadcastMsg(socket, PLAY_AGAIN, msg)
  )

  socket.on(EXIT_GAME, msg => {
    broadcastMsg(socket, EXIT_GAME, msg)
  })

  socket.on(STOP_TURN, msg => {
    broadcastMsg(socket, STOP_TURN, msg)
  })

  socket.on('disconnecting', function (reason) {
    console.log("socket disconnected, reason: ", reason)
    const rooms = Object.keys(socket.rooms)
    //TODO: for each room, need to broadcast that user left
    //NOTE: should only be one room
    rooms.forEach(roomId => {
      sio_server.in(roomId).clients((error, clients) => {
        if (error) throw error;

        if (clients && clients.length > 0) {
          console.log("broadcasting user left to roomId: ", roomId)
          broadcastMsg(socket, USER_LEFT, {roomId, socketId: socket.id})
        } else {
          //No one left in this room
          console.log("all clients have left the room: ", roomId)
        }
      })
    })
  })
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, function listening() {
  console.log('Listening on %d', server.address().port);
  console.log('address: ', server.address());
});