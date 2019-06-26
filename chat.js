const MAX_MESSAGE_BACKLOG = 50
const rooms = new Map()

// const room = {
//   id: "id",
//   displayName: "A Room",
//   messages: [{
//    id: 0,
// 		message: "",
// 		username: "",
// 		clientId: "",
// 		attachments: [
// 			{
// 				id: "STRHASH",
// 				type: "file",
// 				name: "file.txt",
// 				size: 10000, // bytes
// 			},
// 		],
//   }],
// }

let io
let clients = new WeakMap()

// const client = {
//   clientId: 0,
// }

function chat(ioServer) {
  let clientCount = 0
  ioServer.on("connection", socket => {
    socket.on("COMMAND", (name, data, cb) => {
      if (actions[name]) {
        actions[name](socket, data, cb, io)
      }
    })

    const clientId = ++clientCount
    socket.emit("client", {
      id: clientId,
    })

    clients.set(socket, {
      clientId,
    })
  })

  // Create "main" room
  createRoom("main", "General")
  io = ioServer
}

function createRoom(id, displayName) {
  const room = rooms.get(id)

  if (!room) {
    rooms.set(id, {
      id,
      displayName,
      messages: [],
    })
  }
}

const roomQueueMap = new WeakMap()

// Queue new messages to be emitted to all clients
function queueMessageEmit(room, index) {
  const queued = roomQueueMap.get(room)

  if (queued !== true) {
    setTimeout(() => {
      io.emit("newmessages", {
        room: room.id,
        messages: room.messages.slice(index),
      })

      roomQueueMap.set(room, false)
    }, 50)

    roomQueueMap.set(room, true)
  }
}

function success(data) {
  return {
    error: null,
    data,
  }
}

function error(message = "Error") {
  return {
    error: message,
    data: null,
  }
}

const actions = {
  post(socket, { room: roomId, message }, done) {
    const room = rooms.get(roomId)
    const client = clients.get(socket)

    if (room) {
      message.id = room.messages.length
      message.clientId = client.clientId
      room.messages.push(message)

      done(success({
        id: message.id,
      }))

      // Queue room emission to clients
      queueMessageEmit(room, room.messages.length - 1)
    } else {
      done(error("No such room"))
    }
  },

  deletemessage(socket, { room: roomId, id: messageId }, done, io) {
    const room = rooms.get(roomId)
    const client = clients.get(socket)

    if (room) {
      const messageIndex = room.messages.findIndex(m => m.id === messageId)
      const message = room.messages[messageIndex]

      if (message && message.clientId === client.clientId) {
        room.messages.splice(messageIndex, 1)

        io.emit("messagedelete", {
          room: roomId,
          id: message.id,
        })
      }
    }
  },

  getmessages(socket, { room: roomId }, done) {
    const room = rooms.get(roomId)

    if (room) {
      done(success({
        messages: room.messages.slice(-MAX_MESSAGE_BACKLOG),
      }))
    } else {
      done(error("No such room"))
    }
  },
}

module.exports = {
  chat,
}
