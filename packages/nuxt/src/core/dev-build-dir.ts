import { readFile, readdir } from 'node:fs/promises'
import { join, relative, resolve } from 'pathe'
import { withTrailingSlash } from 'ufo'
import { addDevServerHandler } from '@nuxt/kit'
import type { Nuxt, NuxtTemplate, RequestEvent } from 'nuxt/schema'

import { APP_SECRET_FILE } from './app-secret.ts'

/**
 * In development, the build directory is served at `/.nuxt/` with the virtual files that
 * exist only in memory, so that agents and devtools can read everything Nuxt generated.
 *
 * - a directory (`/.nuxt/`, `/.nuxt/types/`) lists its files as markdown
 * - a file (`/.nuxt/routes.mjs`) returns its contents as plain text
 * - a virtual module without a path (`#nitro/virtual/app`) is at `/.nuxt/@id/<encoded id>`
 * - `accept: application/json` returns either as JSON
 */
const BUILD_DIR_URL = '/.nuxt/'
const BUILD_DIR_PATH_RE = /^\/\.nuxt(?:\/|$)/
const ID_PREFIX = '@id/'
/** build output, caches and dev server state: not useful to list, though they can still be read */
const UNLISTED_DIRS = new Set(['dist', 'cache', 'manifest', 'vite'])
const UNLISTED_FILES = new Set(['nuxt.lock', 'nuxt.json'])
/** files that must not be served */
const PRIVATE_FILES = new Set([APP_SECRET_FILE])
const WIN32_SEPARATOR_RE = /\\/
const NODE_MODULES_PACKAGE_RE = /\/node_modules\/((?:@[^/]+\/)?[^/]+)\//g
const TEXT_TYPE = 'text/plain; charset=utf-8'

interface BuildDirEntry {
  /** Path relative to the build directory, or `@id/<encoded id>` for a virtual module without one. */
  path: string
  /** Whether the file exists only in memory. */
  virtual: boolean
  /** The package or project file that added it, if known. */
  source?: string
}

interface BuildDirResponse {
  status: number
  type: string
  body: string
}

/** Ids of virtual modules that have no path in the build directory. */
function listModuleIds (nuxt: Nuxt) {
  const { buildDir } = nuxt.options
  // each template is stored under its absolute path and its `#build/` alias
  const ids = Object.keys(nuxt.vfs).filter(id => !id.startsWith('#build/') && !id.startsWith(buildDir) && !WIN32_SEPARATOR_RE.test(id))
  for (const source of nuxt._vfsSources || []) {
    ids.push(...source.keys())
  }
  return [...new Set(ids)].sort()
}

async function readModule (nuxt: Nuxt, id: string) {
  if (id in nuxt.vfs) {
    return nuxt.vfs[id]
  }
  for (const source of nuxt._vfsSources || []) {
    const content = await source.read(id)
    if (content !== undefined) {
      return content
    }
  }
}

async function listFiles (dir: string, prefix = ''): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const path = prefix + entry.name
    if (entry.isDirectory() && !(prefix === '' && UNLISTED_DIRS.has(entry.name))) {
      files.push(...await listFiles(join(dir, entry.name), path + '/'))
    } else if (entry.isFile() && !PRIVATE_FILES.has(path) && !(prefix === '' && UNLISTED_FILES.has(entry.name))) {
      files.push(path)
    }
  }
  return files
}

/** Nuxt's own templates, which have no `_path` as they are not added with `addTemplate`. */
async function getCoreTemplateFilenames () {
  // imported when needed, as `templates.ts` and `app.ts` import each other
  const templates = await import('./templates.ts')
  return new Set(Object.values(templates).map(template => template.filename))
}

/** The package (or project file) that added a template, if known. */
function describeTemplateSource (template: NuxtTemplate, rootDir: string, coreTemplates: Set<string | undefined>) {
  if (!template._path) {
    return coreTemplates.has(template.filename) ? 'nuxt' : undefined
  }
  // the last `node_modules` segment is the package that called `addTemplate`
  const packageName = [...template._path.matchAll(NODE_MODULES_PACKAGE_RE)].pop()?.[1]
  return packageName || relative(rootDir, template._path)
}

async function createDescriber (nuxt: Nuxt) {
  const coreTemplates = await getCoreTemplateFilenames()
  return (path: string) => {
    const template = nuxt.apps.default?.templates.find(t => t.filename === path)
    return template ? describeTemplateSource(template, nuxt.options.rootDir, coreTemplates) : undefined
  }
}

async function listBuildDir (nuxt: Nuxt): Promise<BuildDirEntry[]> {
  const describe = await createDescriber(nuxt)
  const entries = new Map<string, BuildDirEntry>()
  for (const id in nuxt.vfs) {
    if (id.startsWith('#build/')) {
      const path = id.slice('#build/'.length)
      entries.set(path, { path, virtual: true, source: describe(path) })
    }
  }
  // templates written to disk are in both, and listed as on disk
  for (const path of await listFiles(nuxt.options.buildDir)) {
    entries.set(path, { path, virtual: false, source: describe(path) })
  }
  const files = [...entries.values()].sort((a, b) => a.path.localeCompare(b.path))
  const modules = listModuleIds(nuxt).map(id => ({ path: ID_PREFIX + encodeURIComponent(id), virtual: true }))
  return [...files, ...modules]
}

async function readBuildDir (nuxt: Nuxt, path: string): Promise<(BuildDirEntry & { content: string }) | undefined> {
  if (path.startsWith(ID_PREFIX)) {
    let id: string
    try {
      id = decodeURIComponent(path.slice(ID_PREFIX.length))
    } catch {
      return
    }
    const content = await readModule(nuxt, id)
    return content === undefined ? undefined : { path, virtual: true, content }
  }
  const { buildDir } = nuxt.options
  const file = resolve(buildDir, path)
  // case-insensitive file systems (macOS, Windows) open `APP-SECRET` as `app-secret`
  if (!file.startsWith(withTrailingSlash(buildDir)) || PRIVATE_FILES.has(relative(buildDir, file).toLowerCase())) {
    return
  }
  const virtualContent = nuxt.vfs['#build/' + path]
  const diskContent = await readFile(file, 'utf8').catch(() => undefined)
  const content = virtualContent ?? diskContent
  if (content === undefined) {
    return
  }
  const describe = await createDescriber(nuxt)
  return { path, virtual: diskContent === undefined, source: describe(path), content }
}

function renderListing (nuxt: Nuxt, dir: string, entries: BuildDirEntry[]) {
  const virtual = new Map<string, string[]>()
  const onDisk: string[] = []
  const modules: string[] = []
  for (const entry of entries) {
    if (entry.path.startsWith(ID_PREFIX)) {
      modules.push(decodeURIComponent(entry.path.slice(ID_PREFIX.length)))
    } else if (entry.virtual) {
      const source = entry.source || 'unknown'
      virtual.set(source, [...virtual.get(source) || [], entry.path])
    } else {
      onDisk.push(entry.path)
    }
  }

  const lines = dir
    ? [`# \`${BUILD_DIR_URL}${dir}\``, '', `Paths are relative to \`${BUILD_DIR_URL}\`.`, '']
    : [
        `# \`${relative(nuxt.options.rootDir, nuxt.options.buildDir) || '.'}\` (Nuxt ${nuxt._version} build directory, generated: do not edit)`,
        '',
        'Edit `nuxt.config`, app or server sources, or module options instead, then run `nuxt prepare` to regenerate it. Most files exist only in memory and are imported as `#build/<path>`: a virtual file missing from disk is expected, do not create it.',
        '',
        'Append a path to this URL to read a file (`routes.mjs` is `#build/routes.mjs`), or a directory with a trailing `/`. Send `accept: application/json` for JSON.',
        '',
      ]
  // Nuxt's own files first, then by package
  const sources = [...virtual.keys()].sort((a, b) => Number(b === 'nuxt') - Number(a === 'nuxt') || a.localeCompare(b))
  if (sources.length) {
    lines.push('## In memory only, by what adds them', '', ...sources.map(source => `- ${source}: ${virtual.get(source)!.join(', ')}`), '')
  }
  if (onDisk.length) {
    lines.push('## On disk', '', `- ${onDisk.join(', ')}`, '')
  }
  if (modules.length) {
    lines.push(`## Server modules (read at \`${ID_PREFIX}<URL-encoded id>\`)`, '', `- ${modules.join(', ')}`, '')
  }
  return lines.join('\n')
}

export async function handleBuildDirRequest (nuxt: Nuxt, pathname: string, accept?: string | null): Promise<BuildDirResponse | undefined> {
  if (!BUILD_DIR_PATH_RE.test(pathname)) {
    return
  }

  const json = !!accept?.includes('application/json')
  // some browsers download `text/markdown` rather than show it
  const markdownType = accept?.includes('text/html') ? TEXT_TYPE : 'text/markdown; charset=utf-8'
  const encodedPath = pathname.slice(BUILD_DIR_URL.length)
  let path: string
  try {
    // a module id stays encoded, as it is listed
    path = encodedPath.startsWith(ID_PREFIX) ? encodedPath : decodeURI(encodedPath)
  } catch {
    return { status: 400, type: TEXT_TYPE, body: 'Malformed path.\n' }
  }

  if (path && !path.endsWith('/')) {
    const file = await readBuildDir(nuxt, path)
    if (file) {
      return json
        ? { status: 200, type: 'application/json', body: JSON.stringify(file) }
        : { status: 200, type: TEXT_TYPE, body: file.content }
    }
  }

  const dir = path && withTrailingSlash(path)
  const entries = (await listBuildDir(nuxt)).filter(entry => entry.path.startsWith(dir))
  if (!entries.length) {
    return { status: 404, type: markdownType, body: `\`${BUILD_DIR_URL}${path}\` was not found. \`${BUILD_DIR_URL}\` lists every file.\n` }
  }
  return json
    ? { status: 200, type: 'application/json', body: JSON.stringify({ path: dir, entries }) }
    : { status: 200, type: markdownType, body: renderListing(nuxt, dir, entries) }
}

const RESPONSE_HEADERS = {
  // the contents must not be readable from another page, even through a `<script>` tag
  'x-content-type-options': 'nosniff',
  'cache-control': 'no-store',
}

/** Answers a request for the build directory, as a portable dev server handler. */
export function createBuildDirHandler (nuxt: Nuxt): (event: RequestEvent) => Promise<Response> {
  return async (event) => {
    const response = await handleBuildDirRequest(nuxt, event.url.pathname, event.req.headers.get('accept'))
      ?? { status: 404, type: TEXT_TYPE, body: '' }
    return new Response(response.body, { status: response.status, headers: { ...RESPONSE_HEADERS, 'content-type': response.type } })
  }
}

/** Serve the build directory at `/.nuxt/` from the dev server. */
export function serveBuildDir (nuxt: Nuxt): void {
  addDevServerHandler({ route: `${BUILD_DIR_URL}**`, handler: { nuxt: createBuildDirHandler(nuxt) } })
}
