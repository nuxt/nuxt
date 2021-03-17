import '~polyfill'
import { Server } from 'http'
import { parentPort } from 'worker_threads'
import type { AddressInfo } from 'net'
import { handle } from '../server'

const server = new Server(handle)

const netServer = server.listen(0, () => {
  parentPort.postMessage({
    event: 'listen',
    port: (netServer.address() as AddressInfo).port
  })
})
