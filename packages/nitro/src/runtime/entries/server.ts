import '~polyfill'
import { Server } from 'http'
import { handle } from '../server'

const server = new Server(handle)

const port = process.env.NUXT_PORT || process.env.PORT || 3000
const host = process.env.NUXT_HOST || process.env.HOST || 'localhost'

server.listen(port, host, (err) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log(`Listening on http://${host}:${port}`)
})

export default {}
