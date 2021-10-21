import '#polyfill'
import { Server } from 'http'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { threadId, parentPort } from 'worker_threads'
import { handle } from '../server'

const server = new Server(handle)

function createSocket () {
  const isWin = process.platform === 'win32'
  const socketName = `worker-${process.pid}-${threadId}.sock`
  if (isWin) {
    return join('\\\\.\\pipe\\nitro', socketName)
  } else {
    const socketDir = join(tmpdir(), 'nitro')
    mkdirSync(socketDir, { recursive: true })
    return join(socketDir, socketName)
  }
}

const socketPath = createSocket()
server.listen(socketPath, () => {
  parentPort.postMessage({ event: 'listen', address: { socketPath } })
})
