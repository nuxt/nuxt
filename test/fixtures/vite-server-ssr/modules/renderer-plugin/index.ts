import { addRendererPlugin, addServerTemplate, addTemplate, addVitePlugin, createResolver, defineNuxtModule, updateTemplates } from '@nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'renderer-plugin' },
  setup (_options, nuxt) {
    let mark = 'from a server template'

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
