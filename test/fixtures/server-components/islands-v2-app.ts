import { cpSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'pathe'

const TEMPLATE_RE = /<template[^>]*>[\s\S]*<\/template>/
// `nuxt-client`, `nuxt-client="expr"` or `:nuxt-client="expr"` inside an opening tag
const NUXT_CLIENT_ATTR_RE = /(<[A-Za-z][^>]*?\s):?nuxt-client(="[^"]*")?(?=[\s/>])/g

/**
 * Copies `<rootDir>/app` to `<rootDir>/<name>`, rewriting `nuxt-client` to `v-load-client` in `.vue` templates.
 * The copy lives on disk because islands v2 scans `v-load-client` targets from source files at build start.
 */
export function prepareIslandsV2App (rootDir: string, name: string): string {
  const srcDir = join(rootDir, name)
  rmSync(srcDir, { recursive: true, force: true, maxRetries: 3 })
  cpSync(join(rootDir, 'app'), srcDir, { recursive: true })
  for (const file of readdirSync(srcDir, { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('.vue')) { continue }
    const path = join(srcDir, file)
    const code = readFileSync(path, 'utf8')
    const rewritten = rewriteNuxtClient(code)
    if (rewritten !== code) { writeFileSync(path, rewritten) }
  }
  return srcDir
}

function rewriteNuxtClient (code: string) {
  const template = code.match(TEMPLATE_RE)?.[0]
  return template ? code.replace(template, () => template.replace(NUXT_CLIENT_ATTR_RE, (_, tag, value = '') => `${tag}v-load-client${value}`)) : code
}
