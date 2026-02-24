import { existsSync } from 'node:fs'
import { addBuildPlugin, addTemplate, addTypeTemplate, createIsIgnored, defineNuxtModule, directoryToURL, getLayerDirectories, resolveAlias, tryResolveModule, updateTemplates, useNitro, useNuxt } from '@nuxt/kit'
import { isAbsolute, join, normalize, relative, resolve } from 'pathe'
import type { Import, InlinePreset, Unimport } from 'unimport'
import { createUnimport, scanDirExports, toExports, toTypeDeclarationFile } from 'unimport'
import escapeRE from 'escape-string-regexp'

import { lookupNodeModuleSubpath, parseNodeModulePath } from 'mlly'
import { isDirectory, logger, resolveToAlias } from '../utils.ts'
import { TransformPlugin } from './transform.ts'
import { appCompatPresets, defaultPresets } from './presets.ts'
import type { ImportsOptions, ResolvedNuxtTemplate } from 'nuxt/schema'

import { pagesImportPresets, routeRulesPresets } from '../pages/module.ts'

const allNuxtPresets = [
  ...pagesImportPresets,
  ...routeRulesPresets,
  ...defaultPresets,
]

export default defineNuxtModule<Partial<ImportsOptions>>({
  meta: {
    name: 'nuxt:imports',
    configKey: 'imports',
  },
  defaults: nuxt => ({
    autoImport: true,
    scan: true,
    presets: defaultPresets,
    global: false,
    imports: [],
    dirs: [],
    transform: {
      include: [
        new RegExp('^' + escapeRE(nuxt.options.buildDir)),
      ],
      exclude: undefined,
    },
    virtualImports: ['#imports'],
    polyfills: true,
  }),
  setup (options, nuxt) {
    // TODO: fix sharing of defaults between invocations of modules
    const presets: InlinePreset[] = JSON.parse(JSON.stringify(options.presets))

    if (options.polyfills) {
      presets.push(...appCompatPresets)
    }

    // composables/ dirs from all layers
    let composablesDirs: string[] = []
    if (options.scan) {
      for (const layer of nuxt.options._layers) {
        // Layer disabled scanning for itself
        if (layer.config?.imports?.scan === false) {
          continue
        }

        composablesDirs.push(
          resolve(layer.config.srcDir, 'composables'),
          resolve(layer.config.srcDir, 'utils'),
          resolve(layer.config.rootDir, layer.config.dir?.shared ?? 'shared', 'utils'),
          resolve(layer.config.rootDir, layer.config.dir?.shared ?? 'shared', 'types'),
        )

        for (const dir of (layer.config.imports?.dirs ?? [])) {
          if (dir) {
            composablesDirs.push(resolve(layer.config.srcDir, resolveAlias(dir, nuxt.options.alias)))
          }
        }
      }

      nuxt.hook('modules:done', async () => {
        await nuxt.callHook('imports:dirs', composablesDirs)
        composablesDirs = composablesDirs.map(dir => normalize(dir))
      })

      // Restart nuxt when composable directories are added/removed
      nuxt.hook('builder:watch', (event, relativePath) => {
        if (!['addDir', 'unlinkDir'].includes(event)) { return }

        const path = resolve(nuxt.options.srcDir, relativePath)
        if (composablesDirs.includes(path)) {
          logger.info(`Directory \`${relativePath}/\` ${event === 'addDir' ? 'created' : 'removed'}`)
          return nuxt.callHook('restart')
        }
      })
    }

    let ctx: Unimport

    // initialise unimport only after all modules
    // have had a chance to register their hooks
    nuxt.hook('modules:done', async () => {
      await nuxt.callHook('imports:sources', presets)

      const { addons: inlineAddons, ...rest } = options
      const [addons, addonsOptions] = Array.isArray(inlineAddons) ? [inlineAddons] : [[], inlineAddons]

      // Create a context to share state between module internals
      ctx = createUnimport({
        injectAtEnd: true,
        ...rest,
        addons: {
          addons,
          vueTemplate: options.autoImport,
          vueDirectives: options.autoImport === false ? undefined : true,
          ...addonsOptions,
        },
        presets,
      })

      await nuxt.callHook('imports:context', ctx)
    })

    // Support for importing from '#imports'
    addTemplate({
      filename: 'imports.mjs',
      getContents: async () => toExports(await ctx.getImports()) + '\nif (import.meta.dev) { console.warn("[nuxt] `#imports` should be transformed with real imports. There seems to be something wrong with the imports plugin.") }',
    })
    nuxt.options.alias['#imports'] = join(nuxt.options.buildDir, 'imports')

    // Transform to inject imports in production mode
    addBuildPlugin(TransformPlugin({
      ctx: {
        injectImports: (code, id, options) => ctx.injectImports(code, id, options),
      },
      options,
      sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client,
    }))

    const priorities = getLayerDirectories(nuxt).map((dirs, i) => [dirs.app, -i] as const).sort(([a], [b]) => b.length - a.length)

    const IMPORTS_TEMPLATE_RE = /\/imports\.(?:d\.ts|mjs)$/
    function isImportsTemplate (template: ResolvedNuxtTemplate) {
      return IMPORTS_TEMPLATE_RE.test(template.filename)
    }

    const isIgnored = createIsIgnored(nuxt)
    const nuxtImportSources = new Set(allNuxtPresets.flatMap(i => i.from))
    const nuxtImports = new Set(presets.flatMap(p => nuxtImportSources.has(p.from) ? p.imports : []))
    const regenerateImports = async () => {
      await ctx.modifyDynamicImports(async (imports) => {
        // Clear old imports
        imports.length = 0

        // Scan for `composables/` and `utils/` directories
        if (options.scan) {
          const scannedImports = await scanDirExports(composablesDirs, {
            fileFilter: file => !isIgnored(file),
          })
          for (const i of scannedImports) {
            i.priority ||= priorities.find(([dir]) => i.from.startsWith(dir))?.[1]
          }
          imports.push(...scannedImports)
        }

        // Modules extending
        await nuxt.callHook('imports:extend', imports)
        for (const i of imports) {
          if (!nuxtImportSources.has(i.from)) {
            const value = i.as || i.name
            if (nuxtImports.has(value) && (!i.priority || i.priority >= 0 /* default priority */)) {
              const relativePath = isAbsolute(i.from) ? `${resolveToAlias(i.from, nuxt)}` : i.from
              logger.error(`\`${value}\` is an auto-imported function that is in use by Nuxt. Overriding it will likely cause issues. Please consider renaming \`${value}\` in \`${relativePath}\`.`)
            }
          }
        }

        return imports
      })

      await updateTemplates({
        filter: isImportsTemplate,
      })
    }

    nuxt.hook('modules:done', () => regenerateImports())

    // Generate types
    addDeclarationTemplates({
      generateTypeDeclarations: options => ctx.generateTypeDeclarations(options),
      getImports: () => ctx.getImports(),
    }, options)

    // Watch composables/ directory
    nuxt.hook('builder:watch', async (_, relativePath) => {
      const path = resolve(nuxt.options.srcDir, relativePath)
      if (options.scan && composablesDirs.some(dir => dir === path || path.startsWith(dir + '/'))) {
        await regenerateImports()
      }
    })

    // Watch for template generation
    nuxt.hook('app:templatesGenerated', async (_app, templates) => {
      // Only regenerate when non-imports templates are updated
      if (templates.some(t => !isImportsTemplate(t))) {
        await regenerateImports()
      }
    })
  },
})

function addDeclarationTemplates (ctx: Pick<Unimport, 'getImports' | 'generateTypeDeclarations'>, options: Partial<ImportsOptions>) {
  const nuxt = useNuxt()

  const resolvedImportPathMap = new Map<string, string>()
  const r = (i: Import) => resolvedImportPathMap.get(i.typeFrom || i.from)

  const SUPPORTED_EXTENSION_RE = new RegExp(`\\.(?:${nuxt.options.extensions.map(i => i.replace('.', '')).join('|')})$`)

  const importPaths = nuxt.options.modulesDir.map(dir => directoryToURL(dir))

  async function cacheImportPaths (imports: Import[]) {
    const importSource = Array.from(new Set(imports.map(i => i.typeFrom || i.from)))
    // skip relative import paths for node_modules that are explicitly installed
    await Promise.all(importSource.map(async (from) => {
      if (resolvedImportPathMap.has(from) || nuxt._dependencies?.has(from)) {
        return
      }
      let path = resolveAlias(from)
      if (!isAbsolute(path)) {
        path = await tryResolveModule(from, importPaths).then(async (r) => {
          if (!r) { return r }

          const { dir, name } = parseNodeModulePath(r)
          if (name && nuxt._dependencies?.has(name)) { return from }

          if (!dir || !name) { return r }
          const subpath = await lookupNodeModuleSubpath(r)
          return join(dir, name, subpath || '')
        }) ?? path
      }

      if (existsSync(path) && !(await isDirectory(path))) {
        path = path.replace(SUPPORTED_EXTENSION_RE, '')
      }

      if (isAbsolute(path)) {
        path = relative(join(nuxt.options.buildDir, 'types'), path)
      }

      resolvedImportPathMap.set(from, path)
    }))
  }

  addTypeTemplate({
    filename: 'imports.d.ts',
    getContents: async ({ nuxt }) => toExports(await ctx.getImports(), nuxt.options.buildDir, true, { declaration: true }),
  })

  const GENERATED_BY_COMMENT = '// Generated by auto imports\n'
  const AUTO_IMPORTS_DISABLED_COMMENT = '// Implicit auto importing is disabled, you can explicitly import from `#imports` instead.\n'

  addTypeTemplate({
    filename: 'types/imports.d.ts',
    getContents: async () => {
      const imports = await ctx.getImports()
      await cacheImportPaths(imports)
      return GENERATED_BY_COMMENT + (
        options.autoImport
          ? await ctx.generateTypeDeclarations({ resolvePath: r })
          : AUTO_IMPORTS_DISABLED_COMMENT
      )
    },
  })

  addTemplate({
    filename: 'types/shared-imports.d.ts',
    getContents: async () => {
      if (!options.autoImport) {
        return GENERATED_BY_COMMENT + AUTO_IMPORTS_DISABLED_COMMENT
      }
      const nitro = useNitro()

      const nuxtImports = await ctx.getImports()

      const nitroImports = await nitro.unimport?.getImports() ?? []
      const nitroImportsByName = new Map<string, Import>(nitroImports.map(i => [i.as || i.name, i]))

      const sharedImports: Import[] = []

      for (const i of nuxtImports) {
        const importName = i.as || i.name
        const nitroImport = nitroImportsByName.get(importName)
        if (!nitroImport || i.dtsDisabled || nitroImport.dtsDisabled) { continue }

        // Only include if both contexts import from the same source
        // to avoid polluting shared space with nitro- or nuxt-only types (as a side-effect)
        if (i.from !== nitroImport.from) { continue }

        sharedImports.push(i)
      }

      await cacheImportPaths(sharedImports)

      // Utilities that exist in both Nuxt and Nitro contexts but with different implementations.
      // These are safe to use in the shared context.
      const handCraftedDeclarations = `
  const useRuntimeConfig: (event?: import('h3').H3Event) => import('nuxt/schema').RuntimeConfig
  const useAppConfig: () => import('nuxt/schema').AppConfig
  const defineAppConfig: <C extends import('nuxt/schema').AppConfigInput>(config: C) => C
  const createError: typeof import('h3')['createError']
  const setResponseStatus: typeof import('h3')['setResponseStatus']`

      return GENERATED_BY_COMMENT + toTypeDeclarationFile(sharedImports, { resolvePath: r }).replace(
        /^declare global \{$/m,
        `declare global {${handCraftedDeclarations}`,
      )
    },
  })
}
