import '~polyfill'
import { Server } from 'http'
import destr from 'destr'
import { handle } from '../server'

const server = new Server(handle)

const port = (destr(process.env.NUXT_PORT || process.env.PORT) || 3000) as number
const hostname = process.env.NUXT_HOST || process.env.HOST || 'localhost'

// @ts-ignore
server.listen(port, hostname, (err) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log(`Listening on http://${hostname}:${port}`)
})

export default {}
