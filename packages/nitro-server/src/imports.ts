import { mkdir, writeFile } from 'node:fs/promises'
import { resolveModuleExportNames } from '@nuxt/kit/internal'
import { resolveModulePath } from 'exsolve'
import { join, normalize, relative } from 'pathe'

interface ImportPreset { from: string, imports: Array<string | { name: string, as?: string }>, typeFrom?: string }

// TODO: defineRenderHandler and useEvent
export const v2ImportsPreset = [
  {
    from: 'nitro/app',
    imports: ['useNitroApp', 'getRouteRules'],
  },
  {
    from: 'nitro/runtime-config',
    imports: ['useRuntimeConfig'],
  },
  {
    from: 'nitro',
    imports: [
      'defineRouteMeta',
      {
        name: 'defineErrorHandler',
        as: 'defineNitroErrorHandler',
      },
      {
        name: 'definePlugin',
        as: 'defineNitroPlugin',
      },
      {
        name: 'definePlugin',
        as: 'nitroPlugin',
      },
    ],
  },
  {
    from: 'nitro/cache',
    imports: [
      'defineCachedFunction',
      { name: 'defineCachedFunction', as: 'cachedFunction' },
      'defineCachedHandler',
      { name: 'defineCachedHandler', as: 'defineCachedEventHandler' },
      { name: 'defineCachedHandler', as: 'cachedEventHandler' },
    ],
  },
  {
    from: 'nitro/storage',
    imports: ['useStorage'],
  },
  {
    from: 'nitro/task',
    imports: ['defineTask', 'runTask'],
  },
]

export async function getH3ImportsPreset () {
  const h3Exports = await resolveModuleExportNames('nitro/h3', {
    url: import.meta.url,
  })
  return {
    from: 'nitro/h3',
    imports: h3Exports.filter(n => !/^[A-Z]/.test(n) && n !== 'use'),
  }
}

const PACKAGE_SUBPATH_RE = /^(?:@[^/]+\/)?[^@./][^/]*\/.+$/

/**
 * Nitro derives the type import path of an auto-import from the resolved file's package `exports`
 * subpath, re-attached to the package directory. For a package whose `exports` map does not mirror
 * its file layout that names a file which does not exist, and under `skipLibCheck` TypeScript
 * silently widens every import from it to `any`.
 *
 * An absolute `typeFrom` bypasses that resolution entirely, so point it at a generated module that
 * re-exports the resolved file by relative path, extension intact, so the package's own declaration
 * file is found.
 *
 * TODO: remove once the next Nitro beta includes https://github.com/nitrojs/nitro/pull/4565
 */
export function withImportTypeShims (presets: ImportPreset[], shimDir: string): { presets: ImportPreset[], writeShims: () => Promise<void> } {
  const shimmed: ImportPreset[] = []
  const shims: Array<[path: string, contents: string]> = []

  for (const preset of presets) {
    const resolved = PACKAGE_SUBPATH_RE.test(preset.from) && resolveModulePath(preset.from, { try: true, from: import.meta.url })
    if (!resolved) {
      shimmed.push(preset)
      continue
    }

    // the shim has to sit outside the generated types directory: Nitro relativises `typeFrom`
    // against that directory without a leading `./`, and a bare specifier would not resolve
    const shim = join(shimDir, preset.from.replace(/\W/g, '_') + '.ts')
    const specifier = relative(shimDir, normalize(resolved))
    shims.push([shim, `export * from '${specifier.startsWith('.') ? specifier : './' + specifier}'\n`])
    shimmed.push({ ...preset, typeFrom: shim })
  }

  return {
    presets: shimmed,
    async writeShims () {
      if (shims.length === 0) { return }
      await mkdir(shimDir, { recursive: true })
      await Promise.all(shims.map(([path, contents]) => writeFile(path, contents, 'utf-8')))
    },
  }
}
