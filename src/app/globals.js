import { writable } from "svelte/store"

export const user = writable({
  name: "Anon",
})

export const messages = writable([
  // {
  //  id: 0,
	// 	message: "",
	// 	username: "",
	// 	attachments: [
	// 		{
	// 			id: "STRHASH",
	// 			type: "file",
	// 			name: "file.txt",
	// 			size: 10000, // bytes
	// 		},
	// 	],
	// }
])

export const room = writable("main")

// Connection socket
let socketBox = {
  socket: null,
  socketId: null,
}

export const socket = writable(socketBox)

let socketUpdate = socket.update.bind(socket)
socket.update = function(updateCb) {
  socketBox = updateCb(socketBox)
  socketUpdate(() => socketBox)
}

socket.get = function() {
  return socketBox
}
