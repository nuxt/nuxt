const Nuxt = require('nuxt')
const app = require('express')()
const server = require('http').createServer(app)
const io = require('socket.io')(server)
const port = process.env.PORT || 3000
const isProd = process.env.NODE_ENV === 'production'

// We instantiate Nuxt.js with the options
let config = require('./nuxt.config.js')
config.dev = !isProd
const nuxt = new Nuxt(config)
app.use(nuxt.render)

// Build only in dev mode
if (config.dev) {
  nuxt.build()
  .catch((error) => {
    console.error(error) // eslint-disable-line no-console
    process.exit(1)
  })
}

// Listen the server
server.listen(port, '0.0.0.0')
console.log('Server listening on localhost:' + port) // eslint-disable-line no-console

// Socket.io
let messages = []
io.on('connection', (socket) => {
  socket.on('last-messages', function (fn) {
    fn(messages.slice(-50))
  });
  socket.on('send-message', function (message) {
    messages.push(message)
    socket.broadcast.emit('new-message', message)
  })
});
