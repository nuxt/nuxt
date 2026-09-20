import { Buffer } from 'node:buffer'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import runner, { buildViteError, getCode, getCompiledPosition, prepareStackTrace } from '../src/vite-node-runner.ts'
import { serializeViteNodeError } from '../src/plugins/vite-node.ts'

// transformed output of `export function useBoom () {\n  throw new Error('boom')\n}`,
// shifted down a line by an injected import, as an SSR transform would
function inlineSourceMap (file: string, charset: boolean, mappings = ';AAAO,gBAAS,UAAW;AACzB,QAAM,IAAI,MAAM,MAAM;AACxB;') {
  const map = {
    version: 3,
    sources: [file],
    sourcesContent: ['export function useBoom () {\n  throw new Error("boom")\n}\n'],
    mappings,
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

const rootAbsoluteFile = '/D:/src/useBoomRootAbsolute.ts'
const driveFile = 'D:/src/useBoomDrive.ts'
runner.moduleCache.update(rootAbsoluteFile, { code: inlineSourceMap(rootAbsoluteFile, false) })
runner.moduleCache.update(driveFile, { code: inlineSourceMap(driveFile, false) })

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

  it.each([
    ['a native path', 'D:\\src\\useBoomDrive.ts', driveFile],
    ['a root-absolute path', '/D:/src/useBoomDrive.ts', driveFile],
    ['a path without the runner\'s leading slash', 'D:/src/useBoomRootAbsolute.ts', rootAbsoluteFile],
    ['a lowercase drive letter', 'd:/src/useBoomDrive.ts', driveFile],
  ])('finds a module the runner holds under a different id for %s', (_, lookup, stored) => {
    expect(getCode(lookup)).toBe(inlineSourceMap(stored, false))
  })

  it('does not invent a module for a drive path the runner never evaluated', () => {
    expect(getCode('D:/src/unknown.ts')).toBeUndefined()
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
    })
    expect(built.message).toBe('Element is missing end tag.')
    expect('hint' in built).toBe(false)
  })

  it('falls back to the module id when vite reported no location', () => {
    const built = buildViteError(serializeViteNodeError(new Error('Something broke'), '/src/pages/broken.vue'), '/src/pages/broken.vue')

    expect(built.loc).toBeUndefined()
    expect(built.id).toBe('/src/pages/broken.vue')
    expect(built.message).toBe('Something broke (/src/pages/broken.vue)')
  })
})

describe('vite-node runner stacks', () => {
  const raise = (file: string) => {
    try {
      vm.runInThisContext('var import_x;\nfunction useBoom() {\n  throw new Error("boom");\n}\nuseBoom()', { filename: file })
    } catch (error) {
      return (error as Error).stack!
    }
    throw new Error('did not throw')
  }

  it('maps frames raised in a transformed module to their source position', () => {
    const stack = raise(viteFile)
    expect(stack).toContain(`    at useBoom (${viteFile}:2:9)`)
    expect(stack).toContain(`    at ${viteFile}:5:1`)
  })

  it('maps with the map the runner holds now, after a module is re-evaluated', () => {
    const file = '/src/useBoomEdited.ts'
    runner.moduleCache.update(file, { code: inlineSourceMap(file, false) })
    expect(raise(file)).toContain(`    at useBoom (${file}:2:9)`)

    runner.moduleCache.invalidateModule(runner.moduleCache.get(file))
    runner.moduleCache.update(file, { code: inlineSourceMap(file, false, ';AACO,gBAAS,UAAW;AACzB,QAAM,IAAI,MAAM,MAAM;AACxB;') })
    expect(raise(file)).toContain(`    at useBoom (${file}:3:9)`)
  })

  it('leaves frames of files the runner did not evaluate alone', () => {
    const stack = raise('/src/not-evaluated.ts')
    expect(stack).toContain('    at useBoom (/src/not-evaluated.ts:3:9)')
    expect(runner.moduleCache.has('/src/not-evaluated.ts')).toBe(false)
  })

  it('maps a frame of a module the runner holds under a drive-lettered id', () => {
    expect(raise('D:\\src\\useBoomDrive.ts')).toContain(':2:9')
  })

  it('maps a frame whose call site spells its file differently from the name it reports', () => {
    const callSite = {
      toString: () => 'useBoom (D:\\src\\useBoomDrive.ts:3:9)',
      getFileName: () => driveFile,
      getLineNumber: () => 3,
      getColumnNumber: () => 9,
    } as unknown as NodeJS.CallSite

    expect(prepareStackTrace(new Error('boom'), [callSite])).toBe(`Error: boom\n    at useBoom (${driveFile}:2:9)`)
  })

  it('leaves a frame alone when its reported position is not in the text', () => {
    const callSite = {
      toString: () => 'useBoom (<anonymous>)',
      getFileName: () => driveFile,
      getLineNumber: () => 3,
      getColumnNumber: () => 9,
    } as unknown as NodeJS.CallSite

    expect(prepareStackTrace(new Error('boom'), [callSite])).toBe('Error: boom\n    at useBoom (<anonymous>)')
  })
})
