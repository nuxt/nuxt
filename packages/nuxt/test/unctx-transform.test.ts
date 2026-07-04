import { describe, expect, it } from 'vitest'

import { UnctxTransformPlugin } from '../src/core/plugins/unctx.ts'

describe('unctx transform in nuxt', () => {
  it('should transform nuxt plugins', async () => {
    const code = `
      export default defineNuxtPlugin({
        async setup () {
          await Promise.resolve()
        }
      })
    `
    expect(await transform(code)).toMatchInlineSnapshot(`
      "/* _processed_nuxt_unctx_transform */
      import { executeAsync as __executeAsync } from "unctx";
      export default defineNuxtPlugin({
        async setup () {let __temp, __restore;
          ;(([__temp,__restore]=__executeAsync(()=>Promise.resolve())),await __temp,__restore());
        }
      },1)"
    `)
  })

  it('should transform vue components using defineNuxtComponent', async () => {
    const code = `
      definePageMeta({
        async middleware() {
          await Promise.resolve()
        }
      })
      export default defineNuxtComponent({
        async setup () {
          await Promise.resolve()
        }
      })
    `
    expect(await transform(code, 'app.ts')).toMatchInlineSnapshot(`
      "/* _processed_nuxt_unctx_transform */
      import { executeAsync as __executeAsync } from "unctx";
      definePageMeta({
        async middleware() {let __temp, __restore;
          ;(([__temp,__restore]=__executeAsync(()=>Promise.resolve())),await __temp,__restore());
        }
      })
      export default defineNuxtComponent({
        async setup () {let __temp, __restore;
          ;(([__temp,__restore]=__executeAsync(()=>Promise.resolve())),await __temp,__restore());
        }
      })"
    `)
  })

  it('should generate a sourcemap that accounts for the prepended transform marker line', async () => {
    // regression test for https://github.com/nuxt/nuxt/issues/35479: the marker
    // used to be string-concatenated onto `result.code` *after* the sourcemap had
    // already been generated from `result.magicString`, so every mapping was off
    // by (at least) the single line the marker itself adds.
    const code = [
      'export default defineNuxtRouteMiddleware(async (to, from) => {',
      '  await Promise.resolve()',
      '  return',
      '})',
      '',
    ].join('\n')

    const { code: transformedCode, map } = await transformWithSourcemap(code)
    const sourceLines = code.split('\n')
    const generatedLines = transformedCode.split('\n')

    const generatedLineIndex = generatedLines.findIndex(line => line.includes('Promise.resolve()'))
    const originalLineIndex = sourceLines.findIndex(line => line.includes('Promise.resolve()'))
    expect(generatedLineIndex).toBeGreaterThanOrEqual(0)
    expect(originalLineIndex).toBeGreaterThanOrEqual(0)

    const mappedLineIndex = findMappedOriginalLine(map!.mappings, generatedLineIndex)
    expect(mappedLineIndex).not.toBeNull()
    expect(sourceLines[mappedLineIndex!]).toContain('Promise.resolve()')
  })
})

function transformWithSourcemap (code: string) {
  const transformerOptions = {
    helperModule: 'unctx',
    asyncFunctions: ['defineNuxtPlugin', 'defineNuxtRouteMiddleware'],
    objectDefinitions: {
      defineNuxtComponent: ['asyncData', 'setup'],
      defineNuxtPlugin: ['setup'],
      definePageMeta: ['middleware', 'validate'],
    },
  }
  const plugin = UnctxTransformPlugin({ sourcemap: true, transformerOptions }).raw({}, {} as any) as any
  return Promise.resolve(plugin.transform.handler(code)) as Promise<{ code: string, map: { mappings: string } }>
}

// Decodes a sourcemap `mappings` string just enough to answer: "which original
// line does a given (0-indexed) generated line's first segment map to?". Source
// line deltas are relative and accumulate across *every* segment in the whole
// mappings string (not reset per generated line), so we must walk all of them
// in order to keep the running total in sync, even though we only report the
// value as of the first segment on the line we care about.
function findMappedOriginalLine (mappings: string, generatedLine: number): number | null {
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let sourceLine = 0
  for (const [lineIndex, line] of mappings.split(';').entries()) {
    if (!line) { continue }
    let firstSegmentSourceLine: number | null = null
    for (const segment of line.split(',')) {
      if (!segment) { continue }
      const fields: number[] = []
      let value = 0
      let shift = 0
      for (const char of segment) {
        const digit = base64Chars.indexOf(char)
        value += (digit & 31) << shift
        if (digit & 32) {
          shift += 5
        } else {
          fields.push(value & 1 ? -(value >> 1) : value >> 1)
          value = 0
          shift = 0
        }
      }
      // segment fields are [generatedColumn, sourceIndex, sourceLine, sourceColumn, ...]
      if (fields.length >= 3) {
        sourceLine += fields[2]!
        firstSegmentSourceLine ??= sourceLine
      }
    }
    if (lineIndex === generatedLine) {
      return firstSegmentSourceLine
    }
  }
  return null
}

function transform (code: string, id = 'app.vue') {
  const transformerOptions = {
    helperModule: 'unctx',
    asyncFunctions: ['defineNuxtPlugin', 'defineNuxtRouteMiddleware'],
    objectDefinitions: {
      defineNuxtComponent: ['asyncData', 'setup'],
      defineNuxtPlugin: ['setup'],
      definePageMeta: ['middleware', 'validate'],
    },
  }
  const plugin = UnctxTransformPlugin({ sourcemap: false, transformerOptions }).raw({}, {} as any) as any
  return plugin.transformInclude(id) ? Promise.resolve(plugin.transform.handler(code)).then((r: any) => r?.code.replace(/^ {6}/gm, '').trim()) : null
}
