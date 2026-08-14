import { readFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'

import { relative, resolve } from 'pathe'
import { setBuildOutput } from '@nuxt/kit'
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import { withTrailingSlash, withoutLeadingSlash } from 'ufo'
import escapeRE from 'escape-string-regexp'
import { normalizeViteManifest, precomputeDependencies } from 'vue-bundle-renderer'
import type { Manifest as RendererManifest } from 'vue-bundle-renderer'
import type { Manifest as ViteClientManifest } from 'vite'
import { serialize } from 'seroval'
import type { ViteBuildContext } from './vite.ts'
import { resolveClientManifestFile } from './utils/config.ts'
import { getResolvedClientBuild } from './client.ts'

export async function writeManifest (ctx: ViteBuildContext) {
  const { nuxt } = ctx
  // This is only used for ssr: false - when ssr is enabled we use vite-node runtime manifest
  const devClientManifest: RendererManifest = {
    '@vite/client': {
      isEntry: true,
      file: '@vite/client',
      css: [],
      module: true,
      resourceType: 'script',
    },
    ...nuxt.options.features.noScripts === 'all'
      ? {}
      : {
          [ctx.entry]: {
            isEntry: true,
            file: ctx.entry,
            module: true,
            resourceType: 'script',
          },
        },
  }

  // Write client manifest for use in vue-bundle-renderer
  const clientDist = resolve(nuxt.options.buildDir, 'dist/client')
  const serverDist = resolve(nuxt.options.buildDir, 'dist/server')

  const clientBuild = getResolvedClientBuild(nuxt) ?? { outDir: clientDist, manifest: 'manifest.json' }
  const manifestFile = nuxt.options.dev
    ? ''
    : resolve(clientBuild.outDir, resolveClientManifestFile(clientBuild.manifest))
  const clientManifest = nuxt.options.dev ? devClientManifest : JSON.parse(readManifestFromDisk(manifestFile)) as ViteClientManifest
  const manifestEntries = Object.values(clientManifest)

  const buildAssetsDir = withTrailingSlash(withoutLeadingSlash(nuxt.options.app.buildAssetsDir))
  const BASE_RE = new RegExp(`^${escapeRE(buildAssetsDir)}`)

  for (const entry of manifestEntries) {
    entry.file &&= entry.file.replace(BASE_RE, '')
    for (const item of ['css', 'assets'] as const) {
      entry[item] &&= entry[item].map((i: string) => i.replace(BASE_RE, ''))
    }
  }

  await mkdir(serverDist, { recursive: true })

  if (ctx.config.build?.cssCodeSplit === false) {
    for (const entry of manifestEntries) {
      if (entry.file?.endsWith('.css')) {
        const key = relative(ctx.config.root!, ctx.entry)
        clientManifest[key]!.css ||= []
        ;(clientManifest[key]!.css as string[]).push(entry.file)
        break
      }
    }
  }

  const manifest = normalizeViteManifest(clientManifest)
  await nuxt.callHook('build:manifest', manifest)
  const precomputed = precomputeDependencies(manifest)
  await writeFile(resolve(serverDist, 'client.manifest.mjs'), 'export default ' + serialize(manifest), 'utf8')
  await writeFile(resolve(serverDist, 'client.precomputed.mjs'), 'export default ' + serialize(precomputed), 'utf8')

  if (!nuxt.options.dev) {
    // The serial (non-`viteEnvironmentApi`) build writes the client manifest and
    // precomputed data to disk instead of via `ClientManifestPlugin`; point the
    // `nuxt/*` build outputs at those emitted modules.
    const manifestPath = resolve(serverDist, 'client.manifest.mjs')
    const precomputedPath = resolve(serverDist, 'client.precomputed.mjs')
    setBuildOutput('clientManifest', () => `export { default } from ${JSON.stringify(manifestPath)}`)
    setBuildOutput('clientPrecomputed', () => `export { default } from ${JSON.stringify(precomputedPath)}`)
    await rm(manifestFile, { force: true })
  }
}

function readManifestFromDisk (manifestFile: string): string {
  try {
    return readFileSync(manifestFile, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw bundlerDiagnostics.NUXT_B7021({ manifestFile })
    }
    throw error
  }
}
