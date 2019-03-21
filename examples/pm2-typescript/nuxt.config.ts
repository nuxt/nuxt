import NuxtConfiguration from '@nuxt/config'

const config: NuxtConfiguration = {
  hooks: {
    listen () {
      if (process.send) {
        process.send('ready')
      }
    }
  }
}

export default config
