import App from "./views/App.html";
import io from "socket-io"
import { socket } from "./globals.js"
import { loadMessages } from "./actions.js"

const app = new App({
	target: document.getElementById("app"),
	props: {},
});

const sock = io.connect("http://" + location.host + "/chat")
socket.update(s => ({
	socket: sock,
}))

// Load current messages after connection is established
sock.on("connect", () => {
	loadMessages()
})

sock.on("client", ({ id }) => {
	socket.update(s => ({
		...s,
		socketId: id,
	}))
})

export default app;
