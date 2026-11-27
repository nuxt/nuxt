import { Buffer } from 'node:buffer'

const INITIAL_BUFFER_SIZE = 64 * 1024
const MAX_BUFFER_SIZE = 1024 * 1024 * 1024

/** Encode a message for the vite-node socket: its JSON, prefixed with its byte length. */
export function encodeMessage (data: unknown): Buffer {
  const message = Buffer.from(JSON.stringify(data), 'utf-8')
  const frame = Buffer.alloc(4 + message.length)
  frame.writeUInt32BE(message.length, 0)
  message.copy(frame, 4)
  return frame
}

/**
 * Decode the messages written with {@link encodeMessage} from the chunks a socket receives,
 * calling `onMessage` with the JSON of each complete message.
 */
export function createMessageDecoder (onMessage: (json: string) => void, onOverflow: (requiredSize: number, maxSize: number) => Error) {
  let buffer = Buffer.alloc(INITIAL_BUFFER_SIZE)
  let writeOffset = 0
  let readOffset = 0

  const compact = () => {
    if (readOffset > 0) {
      buffer.copy(buffer, 0, readOffset, writeOffset)
      writeOffset -= readOffset
      readOffset = 0
    }
  }

  const ensureCapacity = (additionalBytes: number) => {
    const requiredSize = writeOffset + additionalBytes
    if (requiredSize > MAX_BUFFER_SIZE) {
      throw onOverflow(requiredSize, MAX_BUFFER_SIZE)
    }
    if (requiredSize <= buffer.length) {
      return
    }
    compact()
    if (writeOffset + additionalBytes > buffer.length) {
      const grown = Buffer.alloc(Math.min(Math.max(buffer.length * 2, requiredSize), MAX_BUFFER_SIZE))
      buffer.copy(grown, 0, 0, writeOffset)
      buffer = grown
    }
  }

  return {
    /** Append a chunk, decoding the messages it completes. Throws when the buffer limit is exceeded. */
    push (data: Buffer) {
      ensureCapacity(data.length)
      data.copy(buffer, writeOffset)
      writeOffset += data.length

      while (writeOffset - readOffset >= 4) {
        const totalLength = 4 + buffer.readUInt32BE(readOffset)
        if (writeOffset - readOffset < totalLength) {
          break
        }
        const json = buffer.subarray(readOffset + 4, readOffset + totalLength).toString('utf-8')
        readOffset += totalLength
        onMessage(json)
      }

      if (readOffset > buffer.length / 2) {
        compact()
      }
    },
    reset () {
      writeOffset = 0
      readOffset = 0
    },
  }
}
