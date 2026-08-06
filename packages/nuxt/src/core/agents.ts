import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'pathe'
import { resolveModulePath } from 'exsolve'
import { configDiagnostics, defineNuxtModule } from '@nuxt/kit'
import { logger } from '../utils.ts'

const START_MARKER = '<!-- nuxt:agents-docs:start -->'
const END_MARKER = '<!-- nuxt:agents-docs:end -->'
const BLOCK_RE = /<!-- nuxt:agents-docs:start -->[\s\S]*?<!-- nuxt:agents-docs:end -->\n?/

export default defineNuxtModule({
  meta: {
    name: 'nuxt:agents-docs',
  },
  setup (_, nuxt) {
    if (!nuxt.options.dev) {
      return
    }

    // Docs only change when dependencies are (re)installed, so a single write per
    // dev session (once modules have finished resolving config) is enough.
    nuxt.hook('modules:done', () => writeAgentsFile(nuxt.options.rootDir))
  },
})

async function writeAgentsFile (rootDir: string) {
  const docs = await resolveDocs()
  if (!docs) {
    configDiagnostics.NUXT_B5020()
    return
  }

  const relativeDocsDir = withTrailingSlash(relative(rootDir, docs.dir))
  const block = generateAgentsBlock(relativeDocsDir, docs.version)

  const filePath = join(rootDir, 'AGENTS.md')
  const existing = existsSync(filePath) ? await readFile(filePath, 'utf8') : ''
  const content = mergeAgentsContent(existing, block)

  if (content === existing) {
    return
  }

  await writeFile(filePath, content, 'utf8')
  logger.info(`Updated \`AGENTS.md\` with Nuxt v${docs.version} docs for AI agents.`)
}

async function resolveDocs (): Promise<{ dir: string, version: string } | undefined> {
  // Resolved relative to this file (inside the `nuxt` package) rather than the user's
  // project root, so it finds `@nuxt/docs` correctly under any package manager's
  // linking strategy (including pnpm's non-hoisted, isolated `node_modules`).
  const pkgPath = resolveModulePath('@nuxt/docs/package.json', { from: import.meta.url, try: true })
  if (!pkgPath) {
    return undefined
  }

  const pkgJson = await readFile(pkgPath, 'utf8').then(JSON.parse).catch(() => undefined) as { version?: string } | undefined
  if (!pkgJson?.version) {
    return undefined
  }

  return { dir: dirname(pkgPath), version: pkgJson.version }
}

/**
 * Generate the managed `AGENTS.md` block for a given (relative) docs directory and Nuxt version.
 *
 * The wording is a deliberate, forceful directive to *read the docs* rather than an inline
 * summary of APIs: agents perform better when pointed at the source of truth instead of being
 * given a shortcut they could rely on in place of it.
 * @internal
 */
export function generateAgentsBlock (relativeDocsDir: string, version: string): string {
  return `${START_MARKER}
# Nuxt docs for this exact version

This project uses Nuxt v${version}. Your training data may be stale for this version of Nuxt — APIs, conventions, and file structure can differ from what you remember. Before writing or reviewing any Nuxt code, read the relevant guide in \`${relativeDocsDir}\`, which contains documentation matching this exact installed version.
${END_MARKER}`
}

/**
 * Merge a generated block into the existing contents of `AGENTS.md`, touching only the
 * managed region so any hand-written instructions are preserved.
 * @internal
 */
export function mergeAgentsContent (existing: string, block: string): string {
  if (BLOCK_RE.test(existing)) {
    return existing.replace(BLOCK_RE, `${block}\n`)
  }
  return existing.trim()
    ? `${existing.trimEnd()}\n\n${block}\n`
    : `${block}\n`
}

function withTrailingSlash (path: string) {
  return path.endsWith('/') ? path : `${path}/`
}
