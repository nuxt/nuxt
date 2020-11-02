import { createRenderer } from 'vue-bundle-renderer'
import devalue from '@nuxt/devalue'

// @ts-ignore
import { renderToString } from './vue2'
// @ts-ignore
import server from '~build/dist/server/server'
// @ts-ignore
import clientManifest from '~build/dist/server/client.manifest.json'
// @ts-ignore
import htmlTemplate from '~build/views/document.template.js'

const renderer = createRenderer(server, {
  clientManifest,
  renderToString
})

export async function render (url) {
  const ssrContext = {
    url,
    runtimeConfig: {
      public: {},
      private: {}
    }
  }
  const rendered = await renderer.renderToString(ssrContext)

  const state = `<script>window.__NUXT__ = ${devalue(ssrContext.payload)}</script>`
  const html = `<div id="__nuxt">${rendered.html}</div>`

  return htmlTemplate({
    HTML_ATTRS: '',
    HEAD_ATTRS: '',
    BODY_ATTRS: '',
    HEAD: rendered.renderResourceHints() + rendered.renderStyles(),
    APP: html + state + rendered.renderScripts()
  })
}
