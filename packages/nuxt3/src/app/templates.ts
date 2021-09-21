
import type { Nuxt, NuxtApp } from '@nuxt/kit'

import * as templateUtils from '../core/template.utils'

type TemplateContext = {
  nuxt: Nuxt;
  app: NuxtApp;
  utils: typeof templateUtils
}

export const appTemplate = {
  filename: 'app.mjs',
  getContents (ctx: TemplateContext) {
    return `export { default } from '${ctx.app.main}'`
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
    const { app, utils } = ctx
    return [
      utils.importSources(app.plugins.filter(p => !p.mode || p.mode !== 'server').map(p => p.src)),
      'export default [',
      app.plugins.filter(p => !p.mode || p.mode !== 'server').map(p => utils.importName(p.src)).join(',\n  '),
      ']'
    ].join('\n')
  }
}

export const serverPluginTemplate = {
  filename: 'plugins/server.mjs',
  getContents (ctx: TemplateContext) {
    const { app, utils } = ctx
    return [
      "import preload from '#app/plugins/preload.server'",
      utils.importSources(app.plugins.filter(p => !p.mode || p.mode !== 'client').map(p => p.src)),
      'export default [',
      '  preload,',
      app.plugins.filter(p => !p.mode || p.mode !== 'client').map(p => utils.importName(p.src)).join(',\n  '),
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
