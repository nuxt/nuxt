import { createSSRApp } from 'vue'
import plugins from './plugins.client'
import { init } from 'nuxt-app'
import App from '<%= appPath %>'

async function initApp () {
  const app = createSSRApp(App)

  await init({
    app,
    plugins
  })

  await app.$nuxt.callHook('client:create')

  app.mount('#__nuxt')

  await app.$nuxt.callHook('client:mounted')

  console.log('App ready:', app) // eslint-disable-line no-console
}

initApp().catch((error) => {
  console.error('Error while mounting app:', error) // eslint-disable-line no-console
})
