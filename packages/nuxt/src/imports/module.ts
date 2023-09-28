import { addTemplate, addVitePlugin, addWebpackPlugin, defineNuxtModule, isIgnored, logger, resolveAlias, tryResolveModule, updateTemplates, useNuxt } from '@nuxt/kit'
import { isAbsolute, join, normalize, relative, resolve } from 'pathe'
import type { Import, Unimport } from 'unimport'
import { createUnimport, scanDirExports } from 'unimport'
import type { ImportPresetWithDeprecation, ImportsOptions } from 'nuxt/schema'

import { lookupNodeModuleSubpath, parseNodeModulePath } from 'mlly'
import { TransformPlugin } from './transform'
import { defaultPresets } from './presets'

export default defineNuxtModule<Partial<ImportsOptions>>({
  meta: {
    name: 'imports',
    configKey: 'imports'
  },
  defaults: {
    autoImport: true,
    presets: defaultPresets,
    global: false,
    imports: [],
    dirs: [],
    transform: {
      include: [],
      exclude: undefined
    },
    virtualImports: ['#imports']
  },
  async setup (options, nuxt) {
    // TODO: fix sharing of defaults between invocations of modules
    const presets = JSON.parse(JSON.stringify(options.presets)) as ImportPresetWithDeprecation[]

    // Allow modules extending sources
    await nuxt.callHook('imports:sources', presets)

    // Filter disabled sources
    // options.sources = options.sources.filter(source => source.disabled !== true)

    // Create a context to share state between module internals
    const ctx = createUnimport({
      ...options,
      addons: {
        vueTemplate: options.autoImport,
        ...options.addons
      },
      presets
    })

    await nuxt.callHook('imports:context', ctx)

    // composables/ dirs from all layers
    let composablesDirs: string[] = []
    for (const layer of nuxt.options._layers) {
      composablesDirs.push(resolve(layer.config.srcDir, 'composables'))
      composablesDirs.push(resolve(layer.config.srcDir, 'utils'))
      for (const dir of (layer.config.imports?.dirs ?? [])) {
        if (!dir) {
          continue
        }
        composablesDirs.push(resolve(layer.config.srcDir, dir))
      }
    }

    await nuxt.callHook('imports:dirs', composablesDirs)
    composablesDirs = composablesDirs.map(dir => normalize(dir))

    // Restart nuxt when composable directories are added/removed
    nuxt.hook('builder:watch', (event, relativePath) => {
      if (!['addDir', 'unlinkDir'].includes(event)) { return }

      const path = resolve(nuxt.options.srcDir, relativePath)
      if (composablesDirs.includes(path)) {
        logger.info(`Directory \`${relativePath}/\` ${event === 'addDir' ? 'created' : 'removed'}`)
        return nuxt.callHook('restart')
      }
    })

    // Support for importing from '#imports'
    addTemplate({
      filename: 'imports.mjs',
      getContents: async () => await ctx.toExports() + '\nif (import.meta.dev) { console.warn("[nuxt] `#imports` should be transformed with real imports. There seems to be something wrong with the imports plugin.") }'
    })
    nuxt.options.alias['#imports'] = join(nuxt.options.buildDir, 'imports')

    // Transform to inject imports in production mode
    addVitePlugin(() => TransformPlugin.vite({ ctx, options, sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client }))
    addWebpackPlugin(() => TransformPlugin.webpack({ ctx, options, sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client }))

    const priorities = nuxt.options._layers.map((layer, i) => [layer.config.srcDir, -i] as const).sort(([a], [b]) => b.length - a.length)

    const regenerateImports = async () => {
      await ctx.modifyDynamicImports(async (imports) => {
        // Clear old imports
        imports.length = 0
        // Scan `composables/`
        const composableImports = await scanDirExports(composablesDirs, {
          fileFilter: file => !isIgnored(file)
        })
        for (const i of composableImports) {
          i.priority = i.priority || priorities.find(([dir]) => i.from.startsWith(dir))?.[1]
        }
        imports.push(...composableImports)
        // Modules extending
        await nuxt.callHook('imports:extend', imports)
        return imports
      })
    }

    await regenerateImports()

    // Generate types
    addDeclarationTemplates(ctx, options)

    // Add generated types to `nuxt.d.ts`
    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ path: resolve(nuxt.options.buildDir, 'types/imports.d.ts') })
      references.push({ path: resolve(nuxt.options.buildDir, 'imports.d.ts') })
    })

    // Watch composables/ directory
    const templates = [
      'types/imports.d.ts',
      'imports.d.ts',
      'imports.mjs'
    ]
    nuxt.hook('builder:watch', async (_, relativePath) => {
      const path = resolve(nuxt.options.srcDir, relativePath)
      if (composablesDirs.some(dir => dir === path || path.startsWith(dir + '/'))) {
        await updateTemplates({
          filter: template => templates.includes(template.filename)
        })
      }
    })

    nuxt.hook('app:templatesGenerated', async () => {
      await regenerateImports()
    })
  }
})

function addDeclarationTemplates (ctx: Unimport, options: Partial<ImportsOptions>) {
  const nuxt = useNuxt()

  // Remove file extension for benefit of TypeScript
  const stripExtension = (path: string) => path.replace(/\.[a-z]+$/, '')

  const resolvedImportPathMap = new Map<string, string>()
  const r = ({ from }: Import) => resolvedImportPathMap.get(from)
  async function cacheImportPaths (imports: Import[]) {
    for (const i of imports) {
      if (resolvedImportPathMap.has(i.from)) { continue }
      let path = resolveAlias(i.from)
      if (!isAbsolute(path)) {
        path = await tryResolveModule(i.from, nuxt.options.modulesDir).then(async (r) => {
          if (!r) { return r }

          const { dir, name } = parseNodeModulePath(r)
          if (!dir || !name) { return r }
          const subpath = await lookupNodeModuleSubpath(r)
          return join(dir, name, subpath || '')
        }) ?? path
      }
      if (isAbsolute(path)) {
        path = relative(join(nuxt.options.buildDir, 'types'), path)
      }

      path = stripExtension(path)
      resolvedImportPathMap.set(i.from, path)
    }
  }

  addTemplate({
    filename: 'imports.d.ts',
    getContents: () => ctx.toExports(nuxt.options.buildDir, true)
  })

  addTemplate({
    filename: 'types/imports.d.ts',
    getContents: async () => {
      const imports = await ctx.getImports().then(r => r.filter(i => !i.type))
      await cacheImportPaths(imports)
      return '// Generated by auto imports\n' + (
        options.autoImport
          ? await ctx.generateTypeDeclarations({ resolvePath: r })
          : '// Implicit auto importing is disabled, you can use explicitly import from `#imports` instead.'
      )
    }
  })
}
