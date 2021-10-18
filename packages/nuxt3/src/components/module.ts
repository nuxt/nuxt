import { statSync } from 'fs'
import { resolve } from 'pathe'
import { defineNuxtModule, resolveAlias, addVitePlugin, addWebpackPlugin } from '@nuxt/kit'
import type { Component, ComponentsDir } from '@nuxt/kit'
import { componentsTemplate, componentsTypeTemplate } from './templates'
import { scanComponents } from './scan'
import { loaderPlugin } from './loader'

const isPureObjectOrString = (val: any) => (!Array.isArray(val) && typeof val === 'object') || typeof val === 'string'
const isDirectory = (p: string) => { try { return statSync(p).isDirectory() } catch (_e) { return false } }

export default defineNuxtModule({
  name: 'components',
  defaults: {
    dirs: ['~/components']
  },
  setup (options, nuxt) {
    let componentDirs = []
    let components: Component[] = []

    // Resolve dirs
    nuxt.hook('app:resolve', async () => {
      await nuxt.callHook('components:dirs', options.dirs)

      componentDirs = options.dirs.filter(isPureObjectOrString).map((dir) => {
        const dirOptions: ComponentsDir = typeof dir === 'object' ? dir : { path: dir }
        const dirPath = resolveAlias(dirOptions.path, nuxt.options.alias)
        const transpile = typeof dirOptions.transpile === 'boolean' ? dirOptions.transpile : 'auto'
        const extensions = dirOptions.extensions || ['vue'] // TODO: nuxt extensions and strip leading dot

        dirOptions.level = Number(dirOptions.level || 0)

        const present = isDirectory(dirPath)
        if (!present && dirOptions.path !== '~/components') {
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
      if (!components.length) {
        return
      }

      app.templates.push({
        ...componentsTemplate,
        options: { components }
      })

      app.templates.push({
        ...componentsTypeTemplate,
        options: { components, buildDir: nuxt.options.buildDir }
      })

      app.plugins.push({ src: '#build/components' })
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

    if (!nuxt.options.dev) {
      const options = { getComponents: () => components }
      addWebpackPlugin(loaderPlugin.webpack(options))
      addVitePlugin(loaderPlugin.vite(options))
    }
  }
})
