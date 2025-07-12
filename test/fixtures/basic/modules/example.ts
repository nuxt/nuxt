import { addPlugin, addTemplate, createResolver, defineNuxtModule, installModule, useNuxt } from 'nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'my-module',
    configKey: 'sampleModule',
  },
  async setup (_options, nuxt) {
    const resolver = createResolver(import.meta.url)

    const logs = [] as string[]

    // @ts-expect-error this is a test to check if we can add a child module
    nuxt.options.childModule = { foo: 'bing' }

    const childModule = defineNuxtModule<{ foo?: string }>({
      meta: { configKey: 'childModule' },
      defaults: { foo: 'bar' },
      async setup (options) {
        logs.push('Hello from a child module manually installed: ' + JSON.stringify(options))

        await installModule(defineNuxtModule({
          setup () { logs.push('hello from a grandchild module!') },
        }))
      },
    })

    await installModule(childModule, { baz: 'qux' })

    logs.push('Hello from a parent module!')

    addPlugin(resolver.resolve('./runtime/plugin'))
    useNuxt().hook('app:resolve', (app) => {
      app.middleware.push({
        name: 'unctx-test',
        path: resolver.resolve('./runtime/middleware'),
        global: true,
      })
    })

    addTemplate({
      filename: 'custom-module-logs.mjs',
      getContents: () => `export default ${JSON.stringify(logs)}`,
    })
  },
})
