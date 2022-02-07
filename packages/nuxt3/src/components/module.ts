import { statSync } from 'fs'
import { resolve, basename } from 'pathe'
import { defineNuxtModule, resolveAlias, addVitePlugin, addWebpackPlugin } from '@nuxt/kit'
import type { Component, ComponentsDir, ComponentsOptions } from '@nuxt/schema'
import { componentsTemplate, componentsTypeTemplate } from './templates'
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
    dirs: ['~/components']
  },
  setup (componentOptions, nuxt) {
    let componentDirs = []
    let components: Component[] = []

    const normalizeDirs = (dir: any, cwd: string) => {
      if (Array.isArray(dir)) {
        return dir.map(dir => normalizeDirs(dir, cwd)).flat().sort(compareDirByPathLength)
      }
      if (dir === true || dir === undefined) {
        return [{ path: resolve(cwd, 'components') }]
      }
      if (typeof dir === 'string') {
        return {
          path: resolve(cwd, resolveAlias(dir, {
            ...nuxt.options.alias,
            '~': cwd
          }))
        }
      }
      return []
    }

    // Resolve dirs
    nuxt.hook('app:resolve', async () => {
      const allDirs = [
        ...normalizeDirs(componentOptions.dirs, nuxt.options.srcDir),
        ...nuxt.options._extends
          .map(layer => normalizeDirs(layer.config.components, layer.cwd))
          .flat()
      ]

      await nuxt.callHook('components:dirs', allDirs)

      componentDirs = allDirs.filter(isPureObjectOrString).map((dir) => {
        const dirOptions: ComponentsDir = typeof dir === 'object' ? dir : { path: dir }
        const dirPath = resolveAlias(dirOptions.path, nuxt.options.alias)
        const transpile = typeof dirOptions.transpile === 'boolean' ? dirOptions.transpile : 'auto'
        const extensions = (dirOptions.extensions || nuxt.options.extensions).map(e => e.replace(/^\./g, ''))

        dirOptions.level = Number(dirOptions.level || 0)

        const present = isDirectory(dirPath)
        if (!present && basename(dirOptions.path) !== 'components') {
          // eslint-disable-next-line no-console
          console.warn('Components directory not found: `' + dirPath + '`')
        }

        return {
          ...dirOptions,
          // TODO: https://github.com/nuxt/framework/pull/251
          enabled: true,
          path: dirPath,
          extensions,
          pattern: dirOptions.pattern || `**/*.{${extensions.join(',')},}`,
          ignore: [
            '**/*.stories.{js,ts,jsx,tsx}', // ignore storybook files
            '**/*{M,.m,-m}ixin.{js,ts,jsx,tsx}', // ignore mixins
            '**/*.{spec,test}.{js,ts,jsx,tsx}', // ignore tests
            '**/*.d.ts', // .d.ts files
            // TODO: support nuxt ignore patterns
            ...(dirOptions.ignore || [])
          ],
          transpile: (transpile === 'auto' ? dirPath.includes('node_modules') : transpile)
        }
      }).filter(d => d.enabled)

      nuxt.options.build!.transpile!.push(...componentDirs.filter(dir => dir.transpile).map(dir => dir.path))
    })

    // Scan components and add to plugin
    nuxt.hook('app:templates', async (app) => {
      components = await scanComponents(componentDirs, nuxt.options.srcDir!)
      await nuxt.callHook('components:extend', components)

      app.templates.push({
        ...componentsTypeTemplate,
        options: { components, buildDir: nuxt.options.buildDir }
      })

      if (!components.length) {
        return
      }

      app.templates.push({
        ...componentsTemplate,
        options: { components }
      })

      app.plugins.push({ src: '#build/components' })
    })

    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ path: resolve(nuxt.options.buildDir, 'types/components.d.ts') })
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

    const loaderOptions = { getComponents: () => components }
    addWebpackPlugin(loaderPlugin.webpack(loaderOptions))
    addVitePlugin(loaderPlugin.vite(loaderOptions))
  }
})
