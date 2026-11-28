import { addRendererPlugin, addServerTemplate, addTemplate, addTypeTemplate, addVitePlugin, createResolver, defineNuxtModule, updateTemplates } from '@nuxt/kit'

const ruleExtension = ['@nuxt/schema', 'nuxt/schema'].flatMap(module => [
  `declare module '${module}' {`,
  '  interface RouteRuleConfigExtensions {',
  '    rendererPlugin?: { scope?: string, label?: string }',
  '  }',
  '  interface AppRouteRulesExtensions {',
  '    rendererPlugin?: { scope?: string, label?: string }',
  '  }',
  '}',
])

export default defineNuxtModule({
  meta: { name: 'renderer-plugin' },
  setup (_options, nuxt) {
    let mark = 'from a server template'

    addTypeTemplate({
      filename: 'types/renderer-plugin.d.ts',
      getContents: () => [...ruleExtension, 'export {}'].join('\n'),
    }, { nuxt: true, node: true })

    addServerTemplate({
      filename: '#renderer-plugin/template',
      getContents: () => Promise.resolve(`export const mark = ${JSON.stringify(mark)}`),
    })
    addTemplate({
      filename: 'renderer-plugin/mark.mjs',
      getContents: () => `export default ${JSON.stringify(mark)}`,
    })
    addVitePlugin({
      name: 'renderer-plugin:update-template',
      apply: 'serve',
      configureServer (server) {
        server.middlewares.use('/__renderer-plugin/update-template', async (_req, res) => {
          mark = 'from an updated server template'
          await nuxt.runWithContext(() => updateTemplates({ filter: template => template.filename === 'renderer-plugin/mark.mjs' }))
          res.end('updated')
        })
      },
    })

    addRendererPlugin(createResolver(import.meta.url).resolve('./runtime/plugin'))
  },
})
