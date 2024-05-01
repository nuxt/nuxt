import { promises as fsp } from 'fs'
import { resolve, join, dirname, basename } from 'upath'
import type { Plugin } from 'vite'
import Critters from 'critters'
import template from 'lodash.template'
import { genObjectFromRawEntries } from 'knitwork'
import htmlMinifier from 'html-minifier'
import { camelCase } from 'scule'
import genericMessages from '../templates/messages.json'

const r = (...path: string[]) => resolve(join(__dirname, '..', ...path))

const replaceAll = (input, search, replace) => input.split(search).join(replace)

export const RenderPlugin = () => {
  return <Plugin> {
    name: 'render',
    enforce: 'post',
    async writeBundle () {
      const distDir = r('dist')
      const critters = new Critters({ path: distDir })
      const globby = await import('globby').then(r => r.globby)
      const htmlFiles = await globby(r('dist/templates/**/*.html'))

      const templateExports = []

      for (const fileName of htmlFiles) {
        // Infer template name
        const templateName = basename(dirname(fileName))

        // eslint-disable-next-line no-console
        console.log('Processing', templateName)

        // Read source template
        let html = await fsp.readFile(fileName, 'utf-8')
        const isCompleteHTML = html.includes('<!DOCTYPE html>')

        if (html.includes('<html')) {
          // Apply critters to inline styles
          html = await critters.process(html)
        }
        // We no longer need references to external CSS
        html = html.replace(/<link[^>]*>/g, '')

        // Inline SVGs
        const svgSources = Array.from(html.matchAll(/src="([^"]+)"|url([^)]+)/g))
          .map(m => m[1])
          .filter(src => src?.match(/\.svg$/))

        for (const src of svgSources) {
          const svg = await fsp.readFile(r('dist', src), 'utf-8')
          const base64Source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
          html = replaceAll(html, src, base64Source)
        }

        // Inline our scripts
        const scriptSources = Array.from(html.matchAll(/<script[^>]*src="(.*)"[^>]*>[\s\S]*?<\/script>/g))
          .filter(([_block, src]) => src?.match(/^\/.*\.js$/))

        for (const [scriptBlock, src] of scriptSources) {
          let contents = await fsp.readFile(r('dist', src), 'utf-8')
          contents = replaceAll(contents, '/* empty css               */', '').trim()
          html = html.replace(scriptBlock, contents.length ? `<script>${contents}</script>` : '')
        }

        // Minify HTML
        html = htmlMinifier.minify(html, { collapseWhitespace: true })

        if (!isCompleteHTML) {
          html = html.replace('<html><head></head><body>', '')
          html = html.replace('</body></html>', '')
        }

        // Load messages
        const messages = JSON.parse(await fsp.readFile(r(`templates/${templateName}/messages.json`), 'utf-8'))

        // Serialize into a js function
        const jsCode = [
          `const _messages = ${JSON.stringify({ ...genericMessages, ...messages })}`,
          `const _render = ${template(html, { variable: '__var__', interpolate: /{{{?([\s\S]+?)}?}}/g }).toString().replace('__var__', '{ messages }')}`,
          'const _template = (messages) => _render({ messages: { ..._messages, ...messages } })'
        ].join('\n').trim()

        const templateContent = html
          .match(/<body.*?>([\s\S]*)<\/body>/)?.[0]
          .replace(/(?<=<|<\/)body/g, 'div')
          .replace(/messages\./g, '')
          .replace(/<script[^>]*>([\s\S]*?)<\/script>/g, '')
          .replace(/<a href="(\/[^"]*)"([^>]*)>([\s\S]*)<\/a>/g, '<NuxtLink to="$1"$2>\n$3\n</NuxtLink>')
          // eslint-disable-next-line no-template-curly-in-string
          .replace(/<([^>]+) ([a-z]+)="([^"]*)({{\s*(\w+?)\s*}})([^"]*)"([^>]*)>/g, '<$1 :$2="`$3${$5}$6`"$7>')
          .replace(/>{{\s*(\w+?)\s*}}<\/[\w-]*>/g, ' v-text="$1" />')
          .replace(/>{{{\s*(\w+?)\s*}}}<\/[\w-]*>/g, ' v-html="$1" />')
        // We are not matching <link> <script> and <meta> tags as these aren't used yet in nuxt/ui
        // and should be taken care of wherever this SFC is used
        const title = html.match(/<title.*?>([\s\S]*)<\/title>/)?.[1].replace(/{{([\s\S]+?)}}/g, (r) => {
          return `\${${r.slice(2, -2)}}`.replace(/messages\./g, 'props.')
        })
        const styleContent = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)).map(block => block[1]).join('\n')
        const globalStyles = styleContent.replace(/(\.[^{\d][^{]*?\{[^}]*?\})+.?/g, (r) => {
          const lastChar = r[r.length - 1]
          if (lastChar && !['}', '.', '@', '*', ':'].includes(lastChar)) {
            return ';' + lastChar
          }
          return lastChar
        }).replace(/@media[^{]*?\{\}/g, '')
        const inlineScripts = Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g))
          .map(block => block[1])
          .filter(i => !i.includes('const t=document.createElement("link")'))
        const props = genObjectFromRawEntries(Object.entries({ ...genericMessages, ...messages }).map(([key, value]) => [key, {
          type: typeof value === 'string' ? 'String' : typeof value === 'number' ? 'Number' : typeof value === 'boolean' ? 'Boolean' : 'undefined',
          default: JSON.stringify(value)
        }]))
        const vueCode = [
          '<script setup>',
          title && 'import { useHead } from \'#imports\'',
          `const props = defineProps(${props})`,
          title && 'useHead(' + genObjectFromRawEntries([
            ['title', `\`${title}\``],
            ['script', inlineScripts.map(s => ({ children: `\`${s}\`` }))],
            ['style', [{ children: `\`${globalStyles}\`` }]]
          ]) + ')',
          '</script>',
          '<template>',
          templateContent,
          '</template>',
          '<style scoped>',
          styleContent.replace(globalStyles, ''),
          '</style>'
        ].filter(Boolean).join('\n').trim()

        // Generate types
        const types = [
          `export type DefaultMessages = Record<${Object.keys(messages).map(a => `"${a}"`).join(' | ') || 'string'}, string | boolean | number >`,
          'declare const template: (data: Partial<DefaultMessages>) => string',
          'export { template }'
        ].join('\n')

        // Register exports
        templateExports.push({
          exportName: camelCase(templateName),
          templateName,
          types
        })

        // Write new template
        await fsp.writeFile(fileName.replace('/index.html', '.mjs'), `${jsCode}\nexport const template = _template`)
        await fsp.writeFile(fileName.replace('/index.html', '.vue'), vueCode)
        await fsp.writeFile(fileName.replace('/index.html', '.d.mts'), `${types}`)
        await fsp.writeFile(fileName.replace('/index.html', '.d.ts'), `${types}`)

        // Remove original html file
        await fsp.unlink(fileName)
        await fsp.rmdir(dirname(fileName))
      }

      // Write an index file with named exports for each template
      const contents = templateExports.map(exp => `export { template as ${exp.exportName} } from './templates/${exp.templateName}.mjs'`).join('\n')
      await fsp.writeFile(r('dist/index.mjs'), contents, 'utf8')

      await fsp.writeFile(r('dist/index.d.ts'), replaceAll(contents, /\.mjs/g, ''), 'utf8')
      await fsp.writeFile(r('dist/index.d.mts'), replaceAll(contents, /\.mjs/g, ''), 'utf8')
    }
  }
}
