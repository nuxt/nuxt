import connect from 'connect'

const app = connect()

app.use('/ping', (req, res, next) => {
  res.end('pong')
})

export default {
  server: { app },
  render: {
    resourceHints: false,
    http2: {
      push: true
    }
  }
}
