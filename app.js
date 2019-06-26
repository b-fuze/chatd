const express = require("express")
const fs = require("fs")
const socketIo = require("socket.io")
const { Server: httpServer } = require("http")
const { chat } = require("./chat")

const HOST = "0.0.0.0"
const PORT = 80

const app = express()
const appServer = httpServer(app)
const io = socketIo(appServer).of("/chat")
app.use(express.static("src"))
app.disable("x-powered-by")

const home = fs.readFileSync("src/public/index.html", "utf8")

app.get(/\/((room(\/[a-z\d]+)|login)\/?)?$/, (req, res) => {
  res.header("Content-Type", "text/html")
  res.end(home)
})

app.get("/chatd", (req, res) => {
  res.end("OK")
})

// Chat events
chat(io)

appServer.listen(PORT, HOST)
