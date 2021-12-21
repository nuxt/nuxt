import consola from 'consola'
import { addPluginTemplate, defineNuxtModule } from '@nuxt/kit'
import { version } from '../../package.json'
import { middlewareTemplate, storeTemplate } from './templates'
import type { ViteOptions } from './types'

export default defineNuxtModule<ViteOptions>({
  meta: {
    name: 'nuxt-bridge:vite',
    version,
    configKey: 'vite'
  },
  defaults: {},
  setup (viteOptions, nuxt) {
    nuxt.options.cli.badgeMessages.push(`⚡  Vite Mode Enabled (v${version})`)
    // eslint-disable-next-line no-console
    if (viteOptions.experimentWarning !== false && !nuxt.options.test) {
      consola.log(
        '🧪  Vite mode is experimental and some nuxt modules might be incompatible\n',
        '   If found a bug, please report via https://github.com/nuxt/vite/issues with a minimal reproduction.'
      )
    }

    // Disable loading-screen because why have it!
    // @ts-expect-error
    nuxt.options.build.loadingScreen = false
    // @ts-expect-error
    nuxt.options.build.indicator = false
    nuxt.options._modules = nuxt.options._modules
      .filter(m => !(Array.isArray(m) && m[0] === '@nuxt/loading-screen'))

    // Mask nuxt-vite to avoid other modules depending on it's existence
    // TODO: Move to kit
    const getModuleName = (m) => {
      if (Array.isArray(m)) { m = m[0] }
      return m.meta ? m.meta.name : m
    }
    const filterModule = modules => modules.filter(m => getModuleName(m) !== 'nuxt-bridge:vite')
    nuxt.options.modules = filterModule(nuxt.options.modules)
    nuxt.options.buildModules = filterModule(nuxt.options.buildModules)

    if (nuxt.options.store) {
      addPluginTemplate(storeTemplate)
    }
    addPluginTemplate(middlewareTemplate)

    nuxt.hook('builder:prepared', async (builder) => {
      builder.bundleBuilder.close()
      delete builder.bundleBuilder
      const { ViteBuilder } = await import('./vite')
      builder.bundleBuilder = new ViteBuilder(builder)
    })

    // remove templates from nuxt-app
    nuxt.hook('build:templates', (templates) => {
      const templatesFiles = templates.templatesFiles.filter((template) => {
        return !['store.js', 'middleware.js'].includes(template.dst)
      })
      templates.templatesFiles.length = 0
      templates.templatesFiles.push(...templatesFiles)
    })
  }
})
