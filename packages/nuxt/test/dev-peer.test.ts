import { describe, expect, it } from 'vitest'
import { isLoopbackAddress } from '../src/runtime/server/dev/peer'

describe('isLoopbackAddress', () => {
  it.each([
    ['127.0.0.1'],
    ['127.1.2.3'],
    ['::1'],
    ['[::1]'],
    ['::ffff:127.0.0.1'],
    ['::FFFF:127.0.0.1'],
    ['::1%lo0'],
  ])('treats %s as loopback', (address) => {
    expect(isLoopbackAddress(address)).toBe(true)
  })

  it.each([
    ['192.168.0.31'],
    ['10.0.0.5'],
    ['0.0.0.0'],
    ['::ffff:192.168.0.31'],
    ['fe80::1'],
    [''],
    [undefined],
    [null],
  ])('rejects %s', (address) => {
    expect(isLoopbackAddress(address)).toBe(false)
  })
})
