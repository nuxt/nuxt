import '#polyfill'
import { Server } from 'http'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { threadId, parentPort } from 'worker_threads'
import { isWindows, provider } from 'std-env'
import { handle } from '../server'

const server = new Server(handle)

function getAddress () {
  // https://github.com/nuxt/framework/issues/1636
  if (provider === 'stackblitz' || process.env.NITRO_NO_UNIX_SOCKET) {
    return '0'
  }
  const socketName = `worker-${process.pid}-${threadId}.sock`
  if (isWindows) {
    return join('\\\\.\\pipe\\nitro', socketName)
  } else {
    const socketDir = join(tmpdir(), 'nitro')
    mkdirSync(socketDir, { recursive: true })
    return join(socketDir, socketName)
  }
}

const listenAddress = getAddress()
server.listen(listenAddress, () => {
  const _address = server.address()
  parentPort.postMessage({
    event: 'listen',
    address: typeof _address === 'string'
      ? { socketPath: _address }
      : `http://localhost:${_address.port}`
  })
})
