import { describe, expect, it } from 'vitest'
import { createMFS } from '../src/utils/mfs'

describe('createMFS', () => {
  it('reads files asynchronously', async () => {
    const fs = createMFS()
    fs.writeFileSync('/test.txt', 'hello')

    const contents = await (fs.readFile as unknown as (path: string, encoding: BufferEncoding) => Promise<string>)('/test.txt', 'utf8')

    expect(contents).toBe('hello')
  })
})
