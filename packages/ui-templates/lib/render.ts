import { fileURLToPath } from 'node:url'
import { readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { copyFile, mkdir } from 'node:fs/promises'
import { basename, dirname, join } from 'pathe'
import type { Plugin } from 'vite'
import Beasties from 'beasties'
import { genObjectFromRawEntries } from 'knitwork'
import htmlnano from 'htmlnano'
import { glob } from 'tinyglobby'
import { camelCase } from 'scule'

import { version } from '../../nuxt/package.json'
import genericMessages from '../templates/messages.json'

const r = (path: string) => fileURLToPath(new URL(join('..', path), import.meta.url))
const replaceAll = (input: string, search: string | RegExp, replace: string) => input.split(search).join(replace)

export const RenderPlugin = () => {
  let outputDir: string
  return <Plugin> {
    name: 'render',
    configResolved (config) {
      outputDir = r(config.build.outDir)
    },
    enforce: 'post',
    async writeBundle () {
      const critters = new Beasties({ path: outputDir })
      const htmlFiles = await glob(['templates/**/*.html'], {
        cwd: outputDir,
        absolute: true,
      })

      const templateExports: Array<{
        exportName: string
        templateName: string
        types: string
      }> = []

      for (const fileName of htmlFiles) {
        // Infer template name
        const templateName = basename(dirname(fileName))

        // eslint-disable-next-line no-console
        console.log('Processing', templateName)

        // Read source template
        let html = readFileSync(fileName, 'utf-8')
        const isCompleteHTML = html.includes('<!DOCTYPE html>')

        if (html.includes('<html')) {
          // Apply critters to inline styles
          html = await critters.process(html)
        }
        html = html.replace(/<html[^>]*>/, '<html lang="en">')
        // We no longer need references to external CSS
        html = html.replace(/<link[^>]*>/g, '')

        // Inline SVGs
        const svgSources: string[] = []

        for (const [_, src] of html.matchAll(/src="([^"]+)"|url([^)]+)/g)) {
          if (src?.match(/\.svg$/)) {
            svgSources.push(src)
          }
        }

        for (const src of svgSources) {
          const svg = readFileSync(join(outputDir, src), 'utf-8')
          const base64Source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
          html = replaceAll(html, src, base64Source)
        }

        // Inline our scripts
        const scriptSources: [string, string][] = []

        for (const [block, src] of html.matchAll(/<script[^>]*src="([^"]*)"[^>]*>[\s\S]*?<\/script>/g)) {
          if (src?.match(/^\/.*\.js$/)) {
            scriptSources.push([block, src])
          }
        }

        for (const [scriptBlock, src] of scriptSources) {
          let contents = readFileSync(join(outputDir, src), 'utf-8')
          contents = replaceAll(contents, '/* empty css               */', '').trim()
          html = html.replace(scriptBlock, contents.length ? `<script>${contents}</script>` : '')
        }

        // Minify HTML
        html = await htmlnano.process(html, { collapseWhitespace: 'aggressive' }).then(r => r.html)

        if (!isCompleteHTML) {
          html = html.replace('<html><head></head><body>', '')
          html = html.replace('</body></html>', '')
        }

        html = html.replace(/\{\{ version \}\}/g, version)

        // Load messages
        const messages = JSON.parse(readFileSync(r(`templates/${templateName}/messages.json`), 'utf-8'))

        // Serialize into a js function
        const chunks = html.split(/\{{2,3}[^{}]+\}{2,3}/g).map(chunk => JSON.stringify(chunk))
        const hasMessages = chunks.length > 1
        let hasExpression = false
        let templateString = chunks.shift()
        for (const [_, expression] of html.matchAll(/\{{2,3}([^{}]+)\}{2,3}/g)) {
          if (expression) {
            hasExpression = true
            templateString += ` + escapeHtml(${expression.trim()}) + ${chunks.shift()}`
          }
        }
        if (chunks.length > 0) {
          templateString += ' + ' + chunks.join(' + ')
        }
        const functionalCode = [
          hasExpression ? 'import { escapeHtml } from \'@vue/shared\'\n' : '',
          hasMessages ? `export type DefaultMessages = Record<${Object.keys({ ...genericMessages, ...messages }).map(a => `"${a}"`).join(' | ') || 'string'}, string | boolean | number >` : '',
          hasMessages ? `const _messages = ${JSON.stringify({ ...genericMessages, ...messages })}` : '',
          `export const template = (${hasMessages ? 'messages: Partial<DefaultMessages>' : ''}) => {`,
          hasMessages ? '  messages = { ..._messages, ...messages }' : '',
          `  return ${templateString}`,
          '}',
        ].join('\n')

        const templateContent = html
          .match(/<body[^>]*>([\s\S]*)<\/body>/)?.[0]
          .replace(/(?<=<\/|<)body/g, 'div')
          .replace(/messages\./g, '')
          .replace(/<script[^>]*>([\s\S]*?)<\/script>/g, '')
          .replace(/<a href="(\/[^"]*)"([^>]*)>([\s\S]*)<\/a>/g, '<NuxtLink to="$1"$2>\n$3\n</NuxtLink>')

          .replace(/<([^>]+) ([a-z]+)="([^"]*)(\{\{\s*(\w+)\s*\}\})([^"]*)"([^>]*)>/g, '<$1 :$2="`$3${$5}$6`"$7>')
          .replace(/>\{\{\s*(\w+)\s*\}\}<\/[\w-]*>/g, ' v-text="$1" />')
          .replace(/>\{\{\{\s*(\w+)\s*\}\}\}<\/[\w-]*>/g, ' v-html="$1" />')
        // We are not matching <link> <script> and <meta> tags as these aren't used yet in nuxt/ui
        // and should be taken care of wherever this SFC is used
        const title = html.match(/<title[^>]*>([\s\S]*)<\/title>/)?.[1]?.replace(/\{\{([\s\S]+?)\}\}/g, (r) => {
          return `\${${r.slice(2, -2)}}`.replace(/messages\./g, 'props.')
        })
        const styleContent = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)).map(block => block[1]).join('\n')
        const globalStyles = styleContent.replace(/(\.[^{\d][^{]*\{[^}]*\})+.?/g, (r) => {
          const lastChar = r[r.length - 1]
          if (lastChar && !['}', '.', '@', '*', ':'].includes(lastChar)) {
            return ';' + lastChar
          }
          return lastChar || ''
        }).replace(/@media[^{]*\{\}/g, '')

        const inlineScripts: string[] = []
        for (const [_, i] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
          if (i && !i.includes('const t=document.createElement("link")')) {
            inlineScripts.push(i)
          }
        }

        const props = genObjectFromRawEntries(Object.entries({ ...genericMessages, ...messages }).map(([key, value]) => [key, {
          type: typeof value === 'string' ? 'String' : typeof value === 'number' ? 'Number' : typeof value === 'boolean' ? 'Boolean' : 'undefined',
          default: JSON.stringify(value),
        }]))
        const vueCode = [
          '<script setup>',
          title && 'import { useHead } from \'#imports\'',
          `const props = defineProps(${props})`,
          title && 'useHead(' + genObjectFromRawEntries([
            ['title', `\`${title}\``],
            ['script', inlineScripts.map(s => ({ innerHTML: `\`${s.replace(/[`$]/g, '\\$&')}\`` }))],
            ['style', [{ innerHTML: `\`${globalStyles.replace(/[`$]/g, '\\$&')}\`` }]],
          ]) + ')',
          '</script>',
          '<template>',
          templateContent,
          '</template>',
          '<style scoped>',
          styleContent.replace(globalStyles, ''),
          '</style>',
        ].filter(Boolean).join('\n').trim()

        // Generate types
        const types = [
          `export type DefaultMessages = Record<${Object.keys(messages).map(a => `"${a}"`).join(' | ') || 'string'}, string | boolean | number >`,
          'declare const template: (data: Partial<DefaultMessages>) => string',
          'export { template }',
        ].join('\n')

        // Register exports
        templateExports.push({
          exportName: camelCase(templateName),
          templateName,
          types,
        })

        // Write new template
        writeFileSync(fileName.replace('/index.html', '.ts'), functionalCode)
        writeFileSync(fileName.replace('/index.html', '.vue'), vueCode)

        // Remove original html file
        unlinkSync(fileName)
        rmdirSync(dirname(fileName))
      }

      // we manually copy files across rather than using symbolic links for better windows support
      const nuxtRoot = r('../nuxt')
      for (const file of ['error-404.vue', 'error-500.vue', 'error-dev.vue', 'welcome.vue']) {
        await copyFile(r(`dist/templates/${file}`), join(nuxtRoot, 'src/app/components', file))
      }
      await mkdir(join(nuxtRoot, 'src/core/runtime/nitro/templates'), { recursive: true })
      for (const file of ['error-500.ts', 'error-dev.ts']) {
        await copyFile(r(`dist/templates/${file}`), join(nuxtRoot, 'src/core/runtime/nitro/templates', file))
      }
    },
  }
}
