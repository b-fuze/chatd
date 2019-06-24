const express = require("express")
const fs = require("fs")

const HOST = '0.0.0.0'
const PORT = 80

const app = express()
app.use(express.static("src"))
app.disable('x-powered-by')

const home = fs.readFileSync("src/public/index.html", "utf8")

app.get("/*", (req, res) => {
  res.header("Content-Type", "text/html")
  res.end(home)
})

app.listen(PORT, HOST)

