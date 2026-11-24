import { defineNitroPlugin, useStorage } from 'nitropack/runtime'

export default defineNitroPlugin((nitroApp: any) => {
  if (import.meta.prerender) {
    const paths: string[] = []
    nitroApp.hooks.hook('render:html', async (_html: unknown, { event }: any) => {
      paths.push(event.path)
      await useStorage('build:legacy-storage').setItem('prerendered.json', paths)
    })
  }
})
