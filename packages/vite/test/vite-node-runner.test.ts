import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import runner, { buildViteError, getCode, getCompiledPosition } from '../src/vite-node-runner.ts'
import { serializeViteNodeError } from '../src/plugins/vite-node.ts'

// transformed output of `export function useBoom () {\n  throw new Error('boom')\n}`,
// shifted down a line by an injected import, as an SSR transform would
function inlineSourceMap (file: string, charset: boolean) {
  const map = {
    version: 3,
    sources: [file],
    sourcesContent: ['export function useBoom () {\n  throw new Error("boom")\n}\n'],
    mappings: ';AAAO,gBAAS,UAAW;AACzB,QAAM,IAAI,MAAM,MAAM;AACxB;',
    names: [],
  }
  const type = charset ? 'application/json;charset=utf-8' : 'application/json'
  return 'import { x } from "vite";\nexport function useBoom() {\n  throw new Error("boom");\n}\n'
    + `//# sourceMappingSource=vite-generated\n//# sourceMappingURL=data:${type};base64,${Buffer.from(JSON.stringify(map)).toString('base64')}\n`
}

const viteFile = '/src/useBoom.ts'
const charsetFile = '/src/useBoomCharset.ts'
runner.moduleCache.update(viteFile, { code: inlineSourceMap(viteFile, false) })
runner.moduleCache.update(charsetFile, { code: inlineSourceMap(charsetFile, true) })

describe('vite-node runner sourcemaps', () => {
  it('exposes the transformed code with its inline sourcemap comment intact', () => {
    expect(getCode(viteFile)).toBe(inlineSourceMap(viteFile, false))
    expect(getCode('/src/unknown.ts')).toBeUndefined()
  })

  it('reports the position in the transformed code a source position was mapped from', () => {
    expect(getCompiledPosition(viteFile, 2, 9)).toEqual({ file: viteFile, line: 3, column: 9 })
    expect(getCompiledPosition(charsetFile, 2, 9)).toEqual({ file: charsetFile, line: 3, column: 9 })
    expect(getCompiledPosition('/src/unknown.ts', 2, 9)).toBeUndefined()
  })
})

describe('vite transform errors over the socket', () => {
  it('carries the location, plugin and code frame vite reported', () => {
    const error = Object.assign(new Error('[plugin:vite:vue] /src/pages/broken.vue:3:5 Element is missing end tag.\n\n1  |  <template>\n2  |    <div>\n'), {
      id: '/src/pages/broken.vue',
      frame: '1  |  <template>\n2  |    <div>\n',
      loc: { file: '/src/pages/broken.vue', line: 3, column: 5 },
      plugin: 'vite:vue',
      pluginCode: '<template><div></template>',
    })

    const built = buildViteError(serializeViteNodeError(error, '/src/pages/broken.vue'), '/src/pages/broken.vue')

    expect(built).toMatchObject({
      id: '/src/pages/broken.vue',
      loc: { file: '/src/pages/broken.vue', line: 3, column: 5 },
      plugin: 'vite:vue',
      pluginCode: '<template><div></template>',
      frame: error.frame,
      hint: error.frame,
    })
    expect(built.message).toContain('/src/pages/broken.vue:3:5')
    expect(built.message).toContain('Element is missing end tag.')
  })

  it('falls back to the module id when vite reported no location', () => {
    const built = buildViteError(serializeViteNodeError(new Error('Something broke'), '/src/pages/broken.vue'), '/src/pages/broken.vue')

    expect(built.loc).toBeUndefined()
    expect(built.id).toBe('/src/pages/broken.vue')
    expect(built.message).toContain('Something broke')
  })
})
