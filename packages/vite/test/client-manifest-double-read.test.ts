import { mkdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { runWithNuxtContext } from '@nuxt/kit'
import { dirname, join } from 'pathe'
import type { Nuxt } from '@nuxt/schema'
import type { Plugin, ResolvedConfig } from 'vite'
import { ClientManifestPlugin } from '../src/plugins/client-manifest.ts'

const tmpDir = fileURLToPath(new URL('./.tmp/client-manifest-double-read', import.meta.url))
const outDir = join(tmpDir, 'dist/client')
const manifestFile = join(outDir, '.vite/manifest.json')
const clientEntry = join(tmpDir, 'app/entry.js')

function createNuxt () {
  return {
    options: {
      dev: false,
      app: { buildAssetsDir: '/_nuxt/' },
      features: { noScripts: false },
    },
    buildOutputs: {},
    callHook: () => Promise.resolve(),
  } as unknown as Nuxt
}

function createConfig () {
  const input = { entry: clientEntry }
  return {
    root: tmpDir,
    build: { cssCodeSplit: true, rolldownOptions: { input } },
    environments: {
      client: { build: { outDir, manifest: true, rolldownOptions: { input } } },
    },
  } as unknown as ResolvedConfig
}

/** Instantiate the plugin against a fresh nuxt and resolve its config, as a build would. */
function createPlugin () {
  const nuxt = createNuxt()
  const plugin = runWithNuxtContext(nuxt, () => ClientManifestPlugin(nuxt)) as Plugin
  ;(plugin.configResolved as (config: ResolvedConfig) => void).call(plugin, createConfig())
  return { nuxt, closeBundle: () => (plugin.closeBundle as () => Promise<void>).call(plugin) }
}

/** Write a client manifest whose entry chunk is emitted at `file`. */
async function writeClientManifest (file: string) {
  await mkdir(dirname(manifestFile), { recursive: true })
  await writeFile(manifestFile, JSON.stringify({
    [`app/entry.js`]: { file: `_nuxt/${file}`, src: 'app/entry.js', isEntry: true },
  }), 'utf-8')
}

/** The serialized `nuxt/manifest` build output the ssr bundle will import. */
function clientManifestOutput (nuxt: Nuxt) {
  return nuxt.buildOutputs.clientManifest!()
}

// https://github.com/nuxt/nuxt/issues/36107
describe('client manifest read across closeBundle passes', () => {
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('reuses the manifest when a second pass runs after the first removed it', async () => {
    await writeClientManifest('entry.aaaaaaaa.js')
    const { nuxt, closeBundle } = createPlugin()

    // The first pass consumes the manifest and removes it as its last step.
    await closeBundle()
    expect(clientManifestOutput(nuxt)).toContain('entry.aaaaaaaa.js')

    // A second pass in the same build must not fail on the now-absent file.
    await expect(closeBundle()).resolves.toBeUndefined()
    expect(clientManifestOutput(nuxt)).toContain('entry.aaaaaaaa.js')
  })

  it('picks up a manifest rewritten by a later build rather than reusing the cached one', async () => {
    await writeClientManifest('entry.aaaaaaaa.js')
    const { nuxt, closeBundle } = createPlugin()

    await closeBundle()
    expect(clientManifestOutput(nuxt)).toContain('entry.aaaaaaaa.js')

    // Vite reuses the plugin across rebuilds: a later client build writes a new
    // manifest, which must win over anything cached from the previous one.
    await writeClientManifest('entry.bbbbbbbb.js')
    await closeBundle()

    const output = clientManifestOutput(nuxt)
    expect(output).toContain('entry.bbbbbbbb.js')
    expect(output).not.toContain('entry.aaaaaaaa.js')
  })

  it('still reports `NUXT_B7021` when no manifest was ever emitted', async () => {
    const { closeBundle } = createPlugin()

    await expect(closeBundle()).rejects.toMatchObject({ code: 'NUXT_B7021' })
  })
})
