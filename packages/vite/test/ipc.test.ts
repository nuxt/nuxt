import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'

import { createMessageDecoder, encodeMessage } from '../src/utils/ipc.ts'

function decode (chunks: Buffer[]) {
  const messages: unknown[] = []
  const decoder = createMessageDecoder(json => messages.push(JSON.parse(json)), (required, max) => new Error(`${required} > ${max}`))
  for (const chunk of chunks) {
    decoder.push(chunk)
  }
  return messages
}

describe('vite-node ipc', () => {
  it('prefixes the json of a message with its big-endian byte length', () => {
    expect(encodeMessage({ id: 2 })).toEqual(Buffer.from('000000087b226964223a327d', 'hex'))
  })

  it('decodes messages split across and packed into chunks', () => {
    const first = encodeMessage({ id: 1, data: 'é'.repeat(70_000) })
    const second = encodeMessage({ id: 2 })
    const stream = Buffer.concat([first, second, first])
    const chunks = [stream.subarray(0, 3), stream.subarray(3, 50_000), stream.subarray(50_000, first.length + second.length + 10), stream.subarray(first.length + second.length + 10)]

    expect(decode(chunks)).toEqual([{ id: 1, data: 'é'.repeat(70_000) }, { id: 2 }, { id: 1, data: 'é'.repeat(70_000) }])
  })

  it('discards a partial message on reset', () => {
    const messages: unknown[] = []
    const decoder = createMessageDecoder(json => messages.push(JSON.parse(json)), () => new Error('overflow'))
    const message = encodeMessage({ id: 1 })

    decoder.push(message.subarray(0, 5))
    decoder.reset()
    decoder.push(message)

    expect(messages).toEqual([{ id: 1 }])
  })
})
