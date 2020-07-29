import preload from 'nuxt-app/plugins/preload'
import sharedPlugins from './plugins'

export default [
  ...sharedPlugins,
  preload
]
