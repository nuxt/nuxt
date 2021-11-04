
import type { Nuxt, NuxtApp } from '@nuxt/kit'

import { importName, importSources } from './template.utils'

type TemplateContext = {
  nuxt: Nuxt;
  app: NuxtApp;
}

// TODO: Use an alias
export const appComponentTemplate = {
  filename: 'app-component.mjs',
  getContents (ctx: TemplateContext) {
    return `export { default } from '${ctx.app.mainComponent}'`
  }
}
// TODO: Use an alias
export const rootComponentTemplate = {
  filename: 'root-component.mjs',
  getContents (ctx: TemplateContext) {
    return `export { default } from '${ctx.app.rootComponent}'`
  }
}

export const cssTemplate = {
  filename: 'css.mjs',
  getContents (ctx: TemplateContext) {
    return ctx.nuxt.options.css.map(i => `import '${i.src || i}';`).join('\n')
  }
}

export const clientPluginTemplate = {
  filename: 'plugins/client.mjs',
  getContents (ctx: TemplateContext) {
    const clientPlugins = ctx.app.plugins.filter(p => !p.mode || p.mode !== 'server')
    return [
      importSources(clientPlugins.map(p => p.src)),
      'export default [',
      clientPlugins.map(p => importName(p.src)).join(',\n  '),
      ']'
    ].join('\n')
  }
}

export const serverPluginTemplate = {
  filename: 'plugins/server.mjs',
  getContents (ctx: TemplateContext) {
    const serverPlugins = ctx.app.plugins.filter(p => !p.mode || p.mode !== 'client')
    return [
      "import preload from '#app/plugins/preload.server'",
      importSources(serverPlugins.map(p => p.src)),
      'export default [',
      '  preload,',
      serverPlugins.map(p => importName(p.src)).join(',\n  '),
      ']'
    ].join('\n')
  }
}

export const appViewTemplate = {
  filename: 'views/app.template.html',
  getContents () {
    return `<!DOCTYPE html>
<html {{ HTML_ATTRS }}>

<head {{ HEAD_ATTRS }}>
  {{ HEAD }}
</head>

<body {{ BODY_ATTRS }}>
  {{ APP }}
</body>

</html>
`
  }
}
