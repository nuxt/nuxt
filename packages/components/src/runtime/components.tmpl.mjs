
import { defineAsyncComponent } from 'vue'

const components = {
<%= components.map(c => {
  const exp = c.export === 'default' ? `c.default || c` : `c['${c.export}']`
  const magicComments = [
    `webpackChunkName: "${c.chunkName}"`,
    c.prefetch === true || typeof c.prefetch === 'number' ? `webpackPrefetch: ${c.prefetch}` : false,
    c.preload === true || typeof c.preload === 'number' ? `webpackPreload: ${c.preload}` : false,
  ].filter(Boolean).join(', ')

  return `  ${c.pascalName}: defineAsyncComponent(() => import('${c.filePath}' /* ${magicComments} */).then(c => ${exp}))`
}).join(',\n') %>
}

export default function (nuxt) {
  for (const name in components) {
    nuxt.app.component(name, components[name])
    nuxt.app.component('Lazy' + name, components[name])
  }
}
