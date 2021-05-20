import '~polyfill'
import { Server } from 'http'
import { parentPort } from 'worker_threads'
import { handle } from '../server'
import type { AddressInfo } from 'net'

const server = new Server(handle)

const netServer = server.listen(0, () => {
  parentPort.postMessage({
    event: 'listen',
    port: (netServer.address() as AddressInfo).port
  })
})
