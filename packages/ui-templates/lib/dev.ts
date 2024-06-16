import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promises as fsp } from 'node:fs'
import type { Plugin } from 'vite'
import { template } from 'lodash-es'
import genericMessages from '../templates/messages.json'

const templatesRoot = fileURLToPath(new URL('..', import.meta.url))

const r = (...path: string[]) => resolve(join(templatesRoot, ...path))

export const DevRenderingPlugin = () => {
  return <Plugin>{
    name: 'dev-rendering',
    async transformIndexHtml (html: string, context) {
      const page = context.originalUrl || '/'

      if (page === '/') {
        const templateNames = await fsp.readdir(r('templates'))
        const serializedData = JSON.stringify({ templateNames })
        return html.replace('{{ data }}', serializedData)
      }

      const contents = await fsp.readFile(r(page, 'index.html'), 'utf-8')

      const messages = JSON.parse(await fsp.readFile(r(page, 'messages.json'), 'utf-8'))

      return template(contents, {
        interpolate: /\{\{\{?([\s\S]+?)\}?\}\}/g,
      })({
        messages: { ...genericMessages, ...messages },
      })
    },
  }
}
