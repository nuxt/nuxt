import { definePlugin } from 'nitro'
import { useNitroHooks } from 'nitro/app'

export default definePlugin(() => {
  useNitroHooks().hook('response', (res) => {
    res.headers.set('x-hmr-plugin', 'v1')
  })
})
