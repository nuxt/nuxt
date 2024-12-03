import { existsSync, promises as fsp, lstatSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { ModuleMeta, Nuxt, NuxtConfig, NuxtModule } from '@nuxt/schema'
import { dirname, isAbsolute, join, resolve } from 'pathe'
import { defu } from 'defu'
import { createJiti } from 'jiti'
import { parseNodeModulePath, resolve as resolveModule } from 'mlly'
import { isRelative } from 'ufo'
import { useNuxt } from '../context'
import { resolveAlias, resolvePath } from '../resolve'
import { logger } from '../logger'

const NODE_MODULES_RE = /[/\\]node_modules[/\\]/

/** Installs a module on a Nuxt instance. */
export async function installModule<
  T extends string | NuxtModule,
  Config extends Extract<NonNullable<NuxtConfig['modules']>[number], [T, any]>,
> (moduleToInstall: T, inlineOptions?: [Config] extends [never] ? any : Config[1], nuxt: Nuxt = useNuxt()) {
  const { nuxtModule, buildTimeModuleMeta, resolvedModulePath } = await loadNuxtModuleInstance(moduleToInstall, nuxt)

  const localLayerModuleDirs = new Set<string>()
  for (const l of nuxt.options._layers) {
    const srcDir = l.config.srcDir || l.cwd
    if (!NODE_MODULES_RE.test(srcDir)) {
      localLayerModuleDirs.add(resolve(srcDir, l.config?.dir?.modules || 'modules'))
    }
  }

  // Call module
  const res = await nuxtModule(inlineOptions || {}, nuxt) ?? {}
  if (res === false /* setup aborted */) {
    return
  }

  const modulePath = resolvedModulePath || moduleToInstall
  if (typeof modulePath === 'string') {
    const parsed = parseNodeModulePath(modulePath)
    const moduleRoot = parsed.dir ? parsed.dir + parsed.name : modulePath
    nuxt.options.build.transpile.push(normalizeModuleTranspilePath(moduleRoot))
    const directory = parsed.dir ? moduleRoot : getDirectory(modulePath)
    if (directory !== moduleToInstall && !localLayerModuleDirs.has(directory)) {
      nuxt.options.modulesDir.push(resolve(directory, 'node_modules'))
    }
  }

  nuxt.options._installedModules = nuxt.options._installedModules || []
  const entryPath = typeof moduleToInstall === 'string' ? resolveAlias(moduleToInstall) : undefined

  if (typeof moduleToInstall === 'string' && entryPath !== moduleToInstall) {
    buildTimeModuleMeta.rawPath = moduleToInstall
  }

  nuxt.options._installedModules.push({
    meta: defu(await nuxtModule.getMeta?.(), buildTimeModuleMeta),
    timings: res.timings,
    entryPath,
  })
}

// --- Internal ---

export function getDirectory (p: string) {
  try {
    // we need to target directories instead of module file paths themselves
    // /home/user/project/node_modules/module/index.js -> /home/user/project/node_modules/module
    return isAbsolute(p) && lstatSync(p).isFile() ? dirname(p) : p
  } catch {
    // maybe the path is absolute but does not exist, allow this to bubble up
  }
  return p
}

export const normalizeModuleTranspilePath = (p: string) => {
  return getDirectory(p).split('node_modules/').pop() as string
}

export async function loadNuxtModuleInstance (nuxtModule: string | NuxtModule, nuxt: Nuxt = useNuxt()) {
  let buildTimeModuleMeta: ModuleMeta = {}
  let resolvedModulePath: string | undefined

  const jiti = createJiti(nuxt.options.rootDir, { alias: nuxt.options.alias })

  // Import if input is string
  if (typeof nuxtModule === 'string') {
    const paths = new Set<string>()
    nuxtModule = resolveAlias(nuxtModule, nuxt.options.alias)

    if (isRelative(nuxtModule)) {
      nuxtModule = resolve(nuxt.options.rootDir, nuxtModule)
    }

    paths.add(join(nuxtModule, 'nuxt'))
    paths.add(join(nuxtModule, 'module'))
    paths.add(nuxtModule)

    for (const path of paths) {
      for (const parentURL of nuxt.options.modulesDir) {
        try {
          const src = isAbsolute(path)
            ? pathToFileURL(await resolvePath(path, { cwd: parentURL, fallbackToOriginal: false, extensions: nuxt.options.extensions })).href
            : await resolveModule(path, { url: pathToFileURL(parentURL.replace(/\/node_modules\/?$/, '')), extensions: nuxt.options.extensions })

          nuxtModule = await jiti.import(src, { default: true }) as NuxtModule
          resolvedModulePath = fileURLToPath(new URL(src))

          // nuxt-module-builder generates a module.json with metadata including the version
          const moduleMetadataPath = new URL('module.json', src)
          if (existsSync(moduleMetadataPath)) {
            buildTimeModuleMeta = JSON.parse(await fsp.readFile(moduleMetadataPath, 'utf-8'))
          }
          break
        } catch (error: unknown) {
          const code = (error as Error & { code?: string }).code
          if (code === 'MODULE_NOT_FOUND' || code === 'ERR_PACKAGE_PATH_NOT_EXPORTED' || code === 'ERR_MODULE_NOT_FOUND' || code === 'ERR_UNSUPPORTED_DIR_IMPORT' || code === 'ENOTDIR') {
            continue
          }
          logger.error(`Error while importing module \`${nuxtModule}\`: ${error}`)
          throw error
        }
      }
      if (typeof nuxtModule !== 'string') { break }
    }
  }

  // Throw error if module could not be found
  if (typeof nuxtModule === 'string') {
    throw new TypeError(`Could not load \`${nuxtModule}\`. Is it installed?`)
  }

  // Throw error if input is not a function
  if (typeof nuxtModule !== 'function') {
    throw new TypeError('Nuxt module should be a function: ' + nuxtModule)
  }

  return { nuxtModule, buildTimeModuleMeta, resolvedModulePath } as { nuxtModule: NuxtModule<any>, buildTimeModuleMeta: ModuleMeta, resolvedModulePath?: string }
}
