import { get } from "svelte/store"
import { messages, room, user, socket } from "./globals.js"

export function postCommand(name, data, resCb) {
  const { socket: sock, socketId } = socket.get()

  if (sock) {
    sock.emit("COMMAND", name, data, (data) => {
      if (data.error) {
        console.error(`Error running command "${ name }": ` + data.error)
      } else {
        resCb(data.data)
      }
    })
  }
}

export function postMessage(message) {
  let messageIndex
  const userData = get(user)

  // Post new message and set its message ID when the server responds
  postCommand("post", {
    room: "main",
    message,
  }, ({ id }) => {
    messages.update(messages => {
      messages[messageIndex].id = id
      return messages
    })
  })

	messages.update(messages => {
    messageIndex = messages.length
    const newMessage = {
      id: -1,
  		message: message.message,
			clientId: socket.get().socketId,
  		username: userData.name,
      attachments: [],
  	}

    return messages.concat(newMessage)
  })
}

export function deleteMessage(room, id) {
  messages.update(messages => {
    const msgIndex = messages.findIndex(m => m.id === id)
    let message

    if (msgIndex !== -1 && (message = messages[msgIndex]).clientId === socket.get().socketId) {
      messages.splice(msgIndex, 1)

      console.log("MESSAGE DEL", id, room)
      postCommand("deletemessage", {
        id,
        room,
      }, () => {
        // ... success ?
      })
    }

    return messages
  })
}

export function loadMessages(room = "main") {
  postCommand("getmessages", {
    room,
  }, serverMessages => {
    console.log("MESSAGES", serverMessages);
    messages.update(() => {
      return serverMessages.messages
    })

    syncMessages()
  })
}

export function syncMessages() {
  const { socket: sock, socketId } = socket.get()

  sock.on("newmessages", serverMessages => {
    messages.update(messages => {
      return messages.concat(serverMessages.messages.filter(m => m.clientId !== socketId))
    })
  })

  sock.on("messagedelete", ({ room: roomId, id }) => {
    const curRoom = get(room)

    if (roomId === curRoom) {
      messages.update(messages => messages.filter(m => m.id !== id))
    }
  })
}
