export default {
  components: true,
  plugins: [
    '~/plugins/orchestrated.server'
  ],
  hooks: {
    'vue-renderer': {
      ssr: {
        context (renderContext) {
          // Disable style/script injection based on query params parsed
          // in plugins/orchestrated.server.js
          if (renderContext.excludeStyles) {
            renderContext.renderStyles = () => '<!-- styles disabled -->'
          }
          if (renderContext.excludeScripts) {
            renderContext.renderResourceHints = () => '<!-- resource hints disabled -->'
            renderContext.renderScripts = () => '<!-- scripts disabled -->'
          }
        },
        templateParams (templateParams, renderContext) {
          // Provide template flag for orchestrated scenarios
          templateParams.orchestrated = renderContext.orchestrated
        }
      }
    }
  },
  features: {
    store: true,
    layouts: true,
    meta: false,
    middleware: false,
    transitions: false,
    deprecations: false,
    validate: false,
    asyncData: false,
    fetch: false,
    clientOnline: false,
    clientPrefetch: false,
    clientUseUrl: false,
    componentAliases: false,
    componentClientOnly: false
  }
}
