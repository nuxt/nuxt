import '@nuxt/nitro/dist/runtime/app/nitro.client'
import logs from 'nuxt/app/plugins/logs.client.dev'
import progress from 'nuxt/app/plugins/progress.client'

const plugins = [
  progress
]

if (process.dev) {
  plugins.push(logs)
}

export default plugins
