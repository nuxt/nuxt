import { defineEventHandler } from 'h3'
import { useStorage } from 'nitropack/runtime'

export default defineEventHandler(async () => ({
  mounts: useStorage().getMounts().map(mount => mount.base),
  prerendered: await useStorage('assets:legacy-storage').getItem('routes.json'),
}))
