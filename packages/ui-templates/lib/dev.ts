import { runInNewContext } from 'node:vm'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promises as fsp } from 'node:fs'
import type { Plugin } from 'vite'
import genericMessages from '../templates/messages.json'
import { version } from '../../nuxt/package.json'

const templatesRoot = fileURLToPath(new URL('..', import.meta.url))

const r = (...path: string[]) => resolve(join(templatesRoot, ...path))

export const DevRenderingPlugin = () => {
  return <Plugin>{
    name: 'dev-rendering',
    async transformIndexHtml (html: string, context) {
      const page = context.originalUrl || '/'

      if (page.endsWith('.png')) { return }

      if (page === '/') {
        const templateNames = await fsp.readdir(r('templates'))
        const serializedData = JSON.stringify({ templateNames })
        return html.replace('{{ data }}', serializedData)
      }

      const contents = await fsp.readFile(r(page, 'index.html'), 'utf-8')

      const messages = JSON.parse(await fsp.readFile(r(page, 'messages.json'), 'utf-8'))

      const chunks = contents.split(/\{{2,3}[^{}]+\}{2,3}/g)
      let templateString = chunks.shift()
      for (const expression of contents.matchAll(/\{{2,3}([^{}]+)\}{2,3}/g)) {
        const value = runInNewContext(expression[1]!.trim(), {
          version,
          messages: { ...genericMessages, ...messages },
        })
        templateString += `${value}${chunks.shift()}`
      }
      if (chunks.length > 0) {
        templateString += chunks.join('')
      }

      return templateString
    },
  }
}
