import { describe, expect, it } from 'vitest'
import { createImportFn } from '../src/app/components/islands-v2/import-fn.ts'

const Foo = { name: 'Foo' }
const Named = { name: 'Named' }

describe('createImportFn', () => {
  const importFn = createImportFn({
    '/components/Foo.vue': () => Promise.resolve({ default: Foo, Named }),
  })

  it('loads the export of a chunk keyed verbatim', async () => {
    expect(await importFn('/components/Foo.vue')).toBe(Foo)
    expect(await importFn('/components/Foo.vue', 'Named')).toBe(Named)
  })

  it('throws for a chunk spelled differently from its key', async () => {
    await expect(importFn('components/Foo.vue')).rejects.toThrow('No loader registered for chunk "components/Foo.vue"')
  })

  it('ignores inherited keys', async () => {
    await expect(importFn('constructor')).rejects.toThrow('No loader registered')
  })
})
