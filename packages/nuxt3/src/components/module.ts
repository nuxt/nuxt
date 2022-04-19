import { statSync } from 'node:fs'
import { resolve, basename } from 'pathe'
import { defineNuxtModule, resolveAlias, addTemplate, addPluginTemplate } from '@nuxt/kit'
import type { Component, ComponentsDir, ComponentsOptions } from '@nuxt/schema'
import { componentsPluginTemplate, componentsTemplate, componentsTypeTemplate } from './templates'
import { scanComponents } from './scan'
import { loaderPlugin } from './loader'

const isPureObjectOrString = (val: any) => (!Array.isArray(val) && typeof val === 'object') || typeof val === 'string'
const isDirectory = (p: string) => { try { return statSync(p).isDirectory() } catch (_e) { return false } }
function compareDirByPathLength ({ path: pathA }, { path: pathB }) {
  return pathB.split(/[\\/]/).filter(Boolean).length - pathA.split(/[\\/]/).filter(Boolean).length
}

export default defineNuxtModule<ComponentsOptions>({
  meta: {
    name: 'components',
    configKey: 'components'
  },
  defaults: {
    dirs: []
  },
  setup (componentOptions, nuxt) {
    let componentDirs = []
    const components: Component[] = []

    const normalizeDirs = (dir: any, cwd: string) => {
      if (Array.isArray(dir)) {
        return dir.map(dir => normalizeDirs(dir, cwd)).flat().sort(compareDirByPathLength)
      }
      if (dir === true || dir === undefined) {
        return [{ path: resolve(cwd, 'components') }]
      }
      if (typeof dir === 'string') {
        return {
          path: resolve(cwd, resolveAlias(dir))
        }
      }
      if (!dir) {
        return []
      }
      const dirs = (dir.dirs || [dir]).map(dir => typeof dir === 'string' ? { path: dir } : dir).filter(_dir => _dir.path)
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

        dirOptions.level = Number(dirOptions.level || 0)

        const present = isDirectory(dirPath)
        if (!present && basename(dirOptions.path) !== 'components') {
          // eslint-disable-next-line no-console
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

      nuxt.options.build!.transpile!.push(...componentDirs.filter(dir => dir.transpile).map(dir => dir.path))
    })

    const options = { components, buildDir: nuxt.options.buildDir }

    addTemplate({
      ...componentsTypeTemplate,
      options
    })

    addPluginTemplate({
      ...componentsPluginTemplate,
      options
    })

    nuxt.options.alias['#components'] = resolve(nuxt.options.buildDir, componentsTemplate.filename)
    addTemplate({
      ...componentsTemplate,
      options
    })

    // Scan components and add to plugin
    nuxt.hook('app:templates', async () => {
      options.components = await scanComponents(componentDirs, nuxt.options.srcDir!)
      await nuxt.callHook('components:extend', options.components)
    })

    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ path: resolve(nuxt.options.buildDir, 'components.d.ts') })
    })

    // Watch for changes
    nuxt.hook('builder:watch', async (event, path) => {
      if (!['add', 'unlink'].includes(event)) {
        return
      }
      const fPath = resolve(nuxt.options.rootDir, path)
      if (componentDirs.find(dir => fPath.startsWith(dir.path))) {
        await nuxt.callHook('builder:generateApp')
      }
    })

    const getComponents = () => options.components
    nuxt.hook('vite:extendConfig', (config, { isClient }) => {
      config.plugins = config.plugins || []
      config.plugins.push(loaderPlugin.vite({
        getComponents,
        mode: isClient ? 'client' : 'server'
      }))
    })
    nuxt.hook('webpack:config', (configs) => {
      configs.forEach((config) => {
        config.plugins = config.plugins || []
        config.plugins.push(loaderPlugin.webpack({
          getComponents,
          mode: config.name === 'client' ? 'client' : 'server'
        }))
      })
    })
  }
})
