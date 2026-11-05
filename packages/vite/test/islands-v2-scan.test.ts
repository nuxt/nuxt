import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolve } from 'pathe'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { type ScanSfcOptions, type ScannedImport, collectSfcFiles, scanClientTargets, scanSfcSource } from '../src/plugins/islands-v2/scan'

const tmpDir = fileURLToPath(new URL('./.tmp/islands-v2-scan', import.meta.url))
const root = path.resolve('/project/app')
const file = path.join(root, 'pages/index.vue')

function abs (...segments: string[]) {
  return resolve(...segments)
}

function createOptions (overrides: Partial<ScanSfcOptions> = {}) {
  const targets: string[] = []
  const tags: [sfcFile: string, tag: string, target: ScannedImport][] = []
  const warn = vi.fn()
  const options: ScanSfcOptions = {
    root,
    additionalImports: new Map(),
    registerTarget (sfcFile, tag, target) {
      targets.push(target.path)
      tags.push([sfcFile, tag, target])
    },
    warn,
    ...overrides,
  }
  return { options, targets, tags, warn }
}

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('scanSfcSource', () => {
  it('registers targets imported by the script by tag, with their export, resolving aliases through the bundler', async () => {
    const { options, tags, warn } = createOptions({
      resolveImport: source => Promise.resolve(source === '~/components/Aliased.vue' ? abs(root, 'components/Aliased.vue') + '?v=1' : null),
    })
    await scanSfcSource([
      '<script setup lang="ts">',
      'import Local from \'../components/Local.vue\'',
      'import Aliased from \'~/components/Aliased.vue\'',
      'import { Named } from \'../components/named\'',
      'import type { Props } from \'./types\'',
      '</script>',
      '<template><Local v-load-client /><Aliased v-load-client="cond" /><Named v-load-client /><Local v-load-client /></template>',
    ].join('\n'), file, options)
    const sfcFile = abs(file)
    expect(tags).toEqual([
      [sfcFile, 'Local', { path: abs(root, 'components/Local.vue'), export: 'default' }],
      [sfcFile, 'Aliased', { path: abs(root, 'components/Aliased.vue'), export: 'default' }],
      [sfcFile, 'Named', { path: abs(root, 'components/named'), export: 'Named' }],
    ])
    expect(warn).not.toHaveBeenCalled()
  })

  it('registers auto-imported components under every tag casing, keeping their export', async () => {
    const target = { path: abs(root, 'components/MyButton.ts'), export: 'MyButton' }
    const { options, tags } = createOptions({ additionalImports: new Map([['MyButton', target]]) })
    await scanSfcSource('<template><my-button v-load-client /><MyButton v-load-client /></template>', file, options)
    expect(tags.map(([, tag, scanned]) => [tag, scanned])).toEqual([['my-button', target], ['MyButton', target]])
  })

  it('warns for `<component :is>` and unresolvable tags', async () => {
    const { options, targets, warn } = createOptions()
    await scanSfcSource('<template><component :is="X" v-load-client /><Missing v-load-client /></template>', file, options)
    expect(targets).toEqual([])
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      expect.stringContaining('<component :is> with v-load-client cannot be scanned'),
      expect.stringContaining('cannot resolve v-load-client target "Missing"'),
    ])
  })

  it('ignores files without the marker', async () => {
    const { options, targets, warn } = createOptions({
      additionalImports: new Map([['Foo', { path: abs(root, 'components/Foo.vue'), export: 'default' }]]),
    })
    await scanSfcSource('<template><Foo /></template>', file, options)
    expect(targets).toEqual([])
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('scanClientTargets', () => {
  it('scans every layer directory, including one inside node_modules, but skips nested node_modules', async () => {
    const appDir = path.join(tmpDir, 'app')
    const layerDir = path.join(tmpDir, 'node_modules/layer/app')
    const sfc = (tag: string) => `<script setup>import ${tag} from './${tag}.vue'</script><template><${tag} v-load-client /></template>`
    await rm(tmpDir, { recursive: true, force: true })
    await mkdir(path.join(appDir, 'node_modules/dep'), { recursive: true })
    await mkdir(layerDir, { recursive: true })
    await writeFile(path.join(appDir, 'App.vue'), sfc('AppTarget'))
    await writeFile(path.join(appDir, 'node_modules/dep/Dep.vue'), sfc('DepTarget'))
    await writeFile(path.join(layerDir, 'Layer.vue'), sfc('LayerTarget'))

    const { options, targets } = createOptions({ root: appDir })
    await scanClientTargets(await collectSfcFiles([appDir, layerDir, appDir]), options)
    expect(targets.sort()).toEqual([abs(appDir, 'AppTarget.vue'), abs(layerDir, 'LayerTarget.vue')])
  })
})
