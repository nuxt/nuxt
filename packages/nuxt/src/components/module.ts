import { statSync } from 'node:fs'
import { relative, resolve } from 'pathe'
import { defineNuxtModule, resolveAlias, addTemplate, addPluginTemplate, updateTemplates } from '@nuxt/kit'
import type { Component, ComponentsDir, ComponentsOptions } from '@nuxt/schema'
import { distDir } from '../dirs'
import { componentsPluginTemplate, componentsTemplate, componentsIslandsTemplate, componentsTypeTemplate } from './templates'
import { scanComponents } from './scan'
import { loaderPlugin } from './loader'
import { TreeShakeTemplatePlugin } from './tree-shake'

const isPureObjectOrString = (val: any) => (!Array.isArray(val) && typeof val === 'object') || typeof val === 'string'
const isDirectory = (p: string) => { try { return statSync(p).isDirectory() } catch (_e) { return false } }
function compareDirByPathLength ({ path: pathA }: { path: string }, { path: pathB }: { path: string }) {
  return pathB.split(/[\\/]/).filter(Boolean).length - pathA.split(/[\\/]/).filter(Boolean).length
}

const DEFAULT_COMPONENTS_DIRS_RE = /\/components(\/global|\/islands)?$/

type getComponentsT = (mode?: 'client' | 'server' | 'all') => Component[]

export default defineNuxtModule<ComponentsOptions>({
  meta: {
    name: 'components',
    configKey: 'components'
  },
  defaults: {
    dirs: []
  },
  setup (componentOptions, nuxt) {
    let componentDirs: ComponentsDir[] = []
    const context = {
      components: [] as Component[]
    }

    const getComponents: getComponentsT = (mode) => {
      return (mode && mode !== 'all')
        ? context.components.filter(c => c.mode === mode || c.mode === 'all')
        : context.components
    }

    const normalizeDirs = (dir: any, cwd: string): ComponentsDir[] => {
      if (Array.isArray(dir)) {
        return dir.map(dir => normalizeDirs(dir, cwd)).flat().sort(compareDirByPathLength)
      }
      if (dir === true || dir === undefined) {
        return [
          { path: resolve(cwd, 'components/islands'), island: true },
          { path: resolve(cwd, 'components/global'), global: true },
          { path: resolve(cwd, 'components') }
        ]
      }
      if (typeof dir === 'string') {
        return [
          { path: resolve(cwd, resolveAlias(dir)) }
        ]
      }
      if (!dir) {
        return []
      }
      const dirs: ComponentsDir[] = (dir.dirs || [dir]).map((dir: any): ComponentsDir => typeof dir === 'string' ? { path: dir } : dir).filter((_dir: ComponentsDir) => _dir.path)
      return dirs.map(_dir => ({
        ..._dir,
        path: resolve(cwd, resolveAlias(_dir.path))
      }))
    }

    // Resolve dirs
    nuxt.hook('app:resolve', async () => {
      // components/ dirs from all layers
      const allDirs = nuxt.options._layers
        .map(layer => normalizeDirs(layer.config.components, layer.config.srcDir))
        .flat()

      await nuxt.callHook('components:dirs', allDirs)

      componentDirs = allDirs.filter(isPureObjectOrString).map((dir) => {
        const dirOptions: ComponentsDir = typeof dir === 'object' ? dir : { path: dir }
        const dirPath = resolveAlias(dirOptions.path)
        const transpile = typeof dirOptions.transpile === 'boolean' ? dirOptions.transpile : 'auto'
        const extensions = (dirOptions.extensions || nuxt.options.extensions).map(e => e.replace(/^\./g, ''))

        const present = isDirectory(dirPath)
        if (!present && !DEFAULT_COMPONENTS_DIRS_RE.test(dirOptions.path)) {
          console.warn('Components directory not found: `' + dirPath + '`')
        }

        return {
          global: componentOptions.global,
          ...dirOptions,
          // TODO: https://github.com/nuxt/framework/pull/251
          enabled: true,
          path: dirPath,
          extensions,
          pattern: dirOptions.pattern || `**/*.{${extensions.join(',')},}`,
          ignore: [
            '**/*{M,.m,-m}ixin.{js,ts,jsx,tsx}', // ignore mixins
            '**/*.d.ts', // .d.ts files
            ...(dirOptions.ignore || [])
          ],
          transpile: (transpile === 'auto' ? dirPath.includes('node_modules') : transpile)
        }
      }).filter(d => d.enabled)

      componentDirs = [
        ...componentDirs.filter(dir => !dir.path.includes('node_modules')),
        ...componentDirs.filter(dir => dir.path.includes('node_modules'))
      ]

      nuxt.options.build!.transpile!.push(...componentDirs.filter(dir => dir.transpile).map(dir => dir.path))
    })

    // components.d.ts
    addTemplate({ ...componentsTypeTemplate, options: { getComponents } })
    // components.plugin.mjs
    addPluginTemplate({ ...componentsPluginTemplate, options: { getComponents } } as any)
    // components.server.mjs
    addTemplate({ ...componentsTemplate, filename: 'components.server.mjs', options: { getComponents, mode: 'server' } })
    // components.client.mjs
    addTemplate({ ...componentsTemplate, filename: 'components.client.mjs', options: { getComponents, mode: 'client' } })
    // components.islands.mjs
    if (nuxt.options.experimental.componentIslands) {
      addTemplate({ ...componentsIslandsTemplate, filename: 'components.islands.mjs', options: { getComponents } })
    } else {
      addTemplate({ filename: 'components.islands.mjs', getContents: () => 'export default {}' })
    }

    nuxt.hook('vite:extendConfig', (config, { isClient }) => {
      const mode = isClient ? 'client' : 'server'
        ; (config.resolve!.alias as any)['#components'] = resolve(nuxt.options.buildDir, `components.${mode}.mjs`)
    })
    nuxt.hook('webpack:config', (configs) => {
      for (const config of configs) {
        const mode = config.name === 'server' ? 'server' : 'client'
          ; (config.resolve!.alias as any)['#components'] = resolve(nuxt.options.buildDir, `components.${mode}.mjs`)
      }
    })

    // Do not prefetch global components chunks
    nuxt.hook('build:manifest', (manifest) => {
      const sourceFiles = getComponents().filter(c => c.global).map(c => relative(nuxt.options.srcDir, c.filePath))

      for (const key in manifest) {
        if (manifest[key].isEntry) {
          manifest[key].dynamicImports =
            manifest[key].dynamicImports?.filter(i => !sourceFiles.includes(i))
        }
      }
    })

    // Scan components and add to plugin
    nuxt.hook('app:templates', async () => {
      const newComponents = await scanComponents(componentDirs, nuxt.options.srcDir!)
      await nuxt.callHook('components:extend', newComponents)
      // add server placeholder for .client components server side. issue: #7085
      for (const component of newComponents) {
        if (component.mode === 'client' && !newComponents.some(c => c.pascalName === component.pascalName && c.mode === 'server')) {
          newComponents.push({
            ...component,
            mode: 'server',
            filePath: resolve(distDir, 'app/components/server-placeholder'),
            chunkName: 'components/' + component.kebabName
          })
        }
      }
      context.components = newComponents
    })

    nuxt.hook('prepare:types', ({ references, tsConfig }) => {
      tsConfig.compilerOptions!.paths['#components'] = [relative(nuxt.options.rootDir, resolve(nuxt.options.buildDir, 'components'))]
      references.push({ path: resolve(nuxt.options.buildDir, 'components.d.ts') })
    })

    // Watch for changes
    nuxt.hook('builder:watch', async (event, path) => {
      if (!['add', 'unlink'].includes(event)) {
        return
      }
      const fPath = resolve(nuxt.options.srcDir, path)
      if (componentDirs.find(dir => fPath.startsWith(dir.path))) {
        await updateTemplates({
          filter: template => [
            'components.plugin.mjs',
            'components.d.ts',
            'components.server.mjs',
            'components.client.mjs'
          ].includes(template.filename)
        })
      }
    })

    nuxt.hook('vite:extendConfig', (config, { isClient, isServer }) => {
      const mode = isClient ? 'client' : 'server'

      config.plugins = config.plugins || []
      config.plugins.push(loaderPlugin.vite({
        sourcemap: nuxt.options.sourcemap[mode],
        getComponents,
        mode,
        experimentalComponentIslands: nuxt.options.experimental.componentIslands
      }))
      if (nuxt.options.experimental.treeshakeClientOnly && isServer) {
        config.plugins.push(TreeShakeTemplatePlugin.vite({
          sourcemap: nuxt.options.sourcemap[mode],
          getComponents
        }))
      }
    })
    nuxt.hook('webpack:config', (configs) => {
      configs.forEach((config) => {
        const mode = config.name === 'client' ? 'client' : 'server'
        config.plugins = config.plugins || []
        config.plugins.push(loaderPlugin.webpack({
          sourcemap: nuxt.options.sourcemap[mode],
          getComponents,
          mode,
          experimentalComponentIslands: nuxt.options.experimental.componentIslands
        }))
        if (nuxt.options.experimental.treeshakeClientOnly && mode === 'server') {
          config.plugins.push(TreeShakeTemplatePlugin.webpack({
            sourcemap: nuxt.options.sourcemap[mode],
            getComponents
          }))
        }
      })
    })
  }
})
