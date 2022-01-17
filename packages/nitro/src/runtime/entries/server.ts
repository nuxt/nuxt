import '#polyfill'
import { Server as HttpServer } from 'http'
import { Server as HttpsServer } from 'https'
import destr from 'destr'
import { handle } from '../server'

const cert = process.env.NITRO_SSL_CERT
const key = process.env.NITRO_SSL_KEY

const server = cert && key ? new HttpsServer({ key, cert }, handle) : new HttpServer(handle)

const port = (destr(process.env.NUXT_PORT || process.env.PORT) || 3000) as number
const hostname = process.env.NUXT_HOST || process.env.HOST || 'localhost'

// @ts-ignore
server.listen(port, hostname, (err) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  const protocol = cert && key ? 'https' : 'http'
  console.log(`Listening on ${protocol}://${hostname}:${port}`)
})

export default {}
