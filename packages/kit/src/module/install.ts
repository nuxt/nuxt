import { existsSync, promises as fsp, lstatSync } from 'node:fs'
import { type ModuleMeta, type Nuxt, type NuxtModule } from '@nuxt/schema'
import { dirname, isAbsolute, join } from 'pathe'
import { defu } from 'defu'
import { isNuxt2 } from '../compatibility'
import { useNuxt } from '../context'
import { requireModule } from '../internal/cjs'
import { importModule } from '../internal/esm'
import { resolveAlias, resolvePath } from '../resolve'
import { logger } from '../logger'

/**
 * Install specified Nuxt module programmatically. This is helpful when your module depends on other modules. You can pass the module options as an object to `inlineOptions` and they will be passed to the module's `setup` function.
 * @param moduleToInstall - The module to install. Can be either a string with the module name or a module object itself.
 * @param inlineOptions - An object with the module options to be passed to the module's `setup` function.
 * @param nuxt - Nuxt instance. If not provided, it will be retrieved from the context via `useNuxt()` call.
 * @see {@link https://nuxt.com/docs/api/kit/modules#installmodule documentation}
 */
export async function installModule (
  moduleToInstall: string | NuxtModule,
  // eslint-disable-next-line ts/no-explicit-any
  inlineOptions?: any,
  nuxt: Nuxt = useNuxt()
) {
  const { nuxtModule, buildTimeModuleMeta } = await loadNuxtModuleInstance(
    moduleToInstall,
    nuxt
  )

  // Call module
  const result = (
    // eslint-disable-next-line ts/no-unnecessary-condition
    isNuxt2()

      // @ts-expect-error Nuxt 2 `moduleContainer` is not typed
      // eslint-disable-next-line ts/no-unsafe-argument
      ? await nuxtModule.call(nuxt.moduleContainer, inlineOptions, nuxt)
      : await nuxtModule(inlineOptions, nuxt)
  ) ?? {}

  if (result === false /* setup aborted */) {
    return
  }

  if (typeof moduleToInstall === 'string') {
    nuxt.options.build.transpile.push(
      normalizeModuleTranspilePath(moduleToInstall)
    )

    const directory = getDirectory(moduleToInstall)

    if (directory !== moduleToInstall) {
      nuxt.options.modulesDir.push(getDirectory(moduleToInstall))
    }
  }

  // eslint-disable-next-line ts/no-unnecessary-condition
  nuxt.options._installedModules ||= []

  nuxt.options._installedModules.push({
    meta: defu(await nuxtModule.getMeta?.(), buildTimeModuleMeta),
    timings: result.timings,
    entryPath: typeof moduleToInstall === 'string' ? resolveAlias(moduleToInstall) : undefined
  })
}

// --- Internal ---

export function getDirectory (p: string) {
  try {
    // we need to target directories instead of module file paths themselves
    // /home/user/project/node_modules/module/index.js
    // -> /home/user/project/node_modules/module
    return isAbsolute(p) && lstatSync(p).isFile() ? dirname(p) : p
  } catch {
    // maybe the path is absolute but does not exist, allow this to bubble up
  }
  return p
}

export const normalizeModuleTranspilePath = (p: string) => {
  return getDirectory(p).split('node_modules/').pop() as string
}

export async function loadNuxtModuleInstance (
  nuxtModule: string | NuxtModule,
  nuxt: Nuxt = useNuxt()
) {
  let buildTimeModuleMeta: ModuleMeta = {}

  // Import if input is string
  if (typeof nuxtModule === 'string') {
    const source = await resolvePath(nuxtModule)
    try {
      // Prefer ESM resolution if possible
      // eslint-disable-next-line ts/no-unsafe-assignment
      nuxtModule = await importModule(source, nuxt.options.modulesDir)
        .catch(() => {})
        ?? requireModule(source, { paths: nuxt.options.modulesDir })
    } catch (error: unknown) {
      // eslint-disable-next-line ts/restrict-template-expressions
      logger.error(`Error while requiring module \`${nuxtModule}\`: ${error}`)

      throw error
    }

    // nuxt-module-builder generates a module.json
    // with metadata including the version
    if (existsSync(join(dirname(source), 'module.json'))) {
      // eslint-disable-next-line ts/no-unsafe-assignment
      buildTimeModuleMeta = JSON.parse(
        await fsp.readFile(join(dirname(source), 'module.json'), 'utf8')
      )
    }
  }

  // Throw error if input is not a function
  if (typeof nuxtModule !== 'function') {
    throw new TypeError('Nuxt module should be a function: ' + nuxtModule)
  }

  return {
    nuxtModule,
    buildTimeModuleMeta
  // eslint-disable-next-line ts/no-explicit-any
  } as { nuxtModule: NuxtModule<any>, buildTimeModuleMeta: ModuleMeta }
}
