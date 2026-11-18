import { readdirSync, statSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { matchesGlob } from 'node:path'
import { basename, dirname, join, relative, resolve } from 'pathe'
import { resolveModulePath } from 'exsolve'
import { isIgnored } from '@nuxt/kit'
import { isWithinDir } from '@nuxt/kit/internal'
import type { Nuxt } from '@nuxt/schema'
import type { Nitro, NitroConfig } from 'nitro/types'

import { nitroBuildDiagnostics } from './diagnostics.ts'

interface ScanPathOptions {
  method?: boolean
  env?: boolean
}

interface ScannedFile {
  /** The scanned directory, relative to the scan dir, as Nitro names it in its messages. */
  dir: string
  /** The file, relative to {@link ScannedFile.dir}. */
  path: string
  opts?: ScanPathOptions
}

type ParseScanPath = (nitro: { options: { dev: boolean, scanSuffixes: string[] }, logger: { error: (message: string) => void } }, file: Pick<ScannedFile, 'dir' | 'path'>, opts?: ScanPathOptions) => { name: string } | undefined

/** The Nitro options that decide which files Nitro scans and how it parses their names. */
export type ScanOptions = Pick<NitroConfig, 'apiDir' | 'routesDir' | 'experimental' | 'ignore'> & {
  scanDirs: string[]
  scanSuffixes?: string[]
}

export interface RejectedScanPath {
  path: string
  suffix: string
}

/** Where `parseScanPath` lives in the `nitro` package. */
const PARSE_SCAN_PATH_CHUNK = 'dist/_chunks/utils.mjs'

const SCANNED_FILE_RE = /\.(?:[cm]?[jt]s|[jt]sx)$/
const SCAN_IGNORE_RE = /\.(?:(?:test|spec)\.(?:[cm]?[jt]s|[jt]sx)|d\.[cm]?ts)$/
const MODULE_ENTRY_RE = /^[^/]+(?:\/index\.[^/]+)?$/
const SEGMENT_RE = /^[a-z]+$/

/**
 * The file name parser of the `nitro` package this builder runs, which `nitro` does not
 * export. `undefined` when it cannot be loaded.
 */
export async function loadParseScanPath (): Promise<ParseScanPath | undefined> {
  const manifest = resolveModulePath('nitro/package.json', { from: import.meta.url, try: true })
  if (!manifest) {
    return
  }
  try {
    const { parseScanPath } = await import(pathToFileURL(join(dirname(manifest), PARSE_SCAN_PATH_CHUNK)).href) as { parseScanPath?: unknown }
    return typeof parseScanPath === 'function' ? parseScanPath as ParseScanPath : undefined
  } catch {
    return undefined
  }
}

function scanTargets (options: ScanOptions): Array<{ dir: string, opts?: ScanPathOptions, entriesOnly?: boolean }> {
  const routes = { method: true, env: true }
  return [
    { dir: options.apiDir || 'api', opts: routes },
    { dir: options.routesDir || 'routes', opts: routes },
    { dir: 'middleware' },
    { dir: 'plugins' },
    { dir: 'modules', entriesOnly: true },
    ...options.experimental?.tasks ? [{ dir: 'tasks' }] : [],
  ]
}

/** The scanned directory a file belongs to, if Nitro scans it by its name. */
function toScannedFile (nuxt: Nuxt, options: ScanOptions, path: string): ScannedFile | undefined {
  for (const scanDir of options.scanDirs) {
    for (const target of scanTargets(options)) {
      const root = join(scanDir, target.dir)
      if (path === root || !isWithinDir(path, root)) {
        continue
      }
      const file = relative(root, path)
      if (!SCANNED_FILE_RE.test(file) || SCAN_IGNORE_RE.test(file) || (target.entriesOnly && !MODULE_ENTRY_RE.test(file)) || isIgnored(path, undefined, nuxt) || isNitroIgnored(options, scanDir, path)) {
        return
      }
      return { dir: target.dir, path: file, opts: target.opts }
    }
  }
}

/**
 * Whether a pattern in `nitro.ignore` matches the file, relative to the scan dir. Wildcards
 * here do not match dot segments, so a pattern can miss a file Nitro ignores.
 */
function isNitroIgnored (options: ScanOptions, scanDir: string, path: string): boolean {
  const file = relative(scanDir, path)
  return !!options.ignore?.some(pattern => typeof pattern === 'string' && pattern[0] !== '!' && matchesGlob(file, pattern))
}

/** The suffix Nitro rejects in the name of a scanned file. */
function rejectedSuffix (parse: ParseScanPath, scanSuffixes: string[], file: ScannedFile): string | undefined {
  const accepts = (suffixes: string[]) => !!parse({ options: { dev: true, scanSuffixes: suffixes }, logger: { error () {} } }, file, file.opts)
  if (accepts(scanSuffixes)) {
    return
  }
  return file.path.split(/[./]/).reverse().find(segment => SEGMENT_RE.test(segment) && accepts([...scanSuffixes, segment]))
}

/** A name with a suffix between its stem and its extension. */
const hasSuffix = (path: string) => basename(path).split('.').length > 2

function isLinkToFile (path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

/** Every file in the scanned server directories with a suffix in its name that Nitro rejects. */
export function findRejectedScanSuffixes (nuxt: Nuxt, options: ScanOptions, parse: ParseScanPath): RejectedScanPath[] {
  const found: RejectedScanPath[] = []
  const seen = new Set<string>()
  for (const scanDir of options.scanDirs) {
    for (const target of scanTargets(options)) {
      const root = join(scanDir, target.dir)
      let entries: Dirent[]
      try {
        entries = readdirSync(root, { recursive: true, withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) {
        const path = join(entry.parentPath, entry.name)
        if (seen.has(path) || !hasSuffix(path) || !(entry.isFile() || (entry.isSymbolicLink() && isLinkToFile(path)))) {
          continue
        }
        seen.add(path)
        const file = toScannedFile(nuxt, options, path)
        const suffix = file && rejectedSuffix(parse, options.scanSuffixes || [], file)
        if (suffix) {
          found.push({ path, suffix })
        }
      }
    }
  }
  return found.sort((a, b) => a.path.localeCompare(b.path))
}

function describe (nuxt: Nuxt, rejected: RejectedScanPath[]) {
  const suffixes = [...new Set(rejected.map(entry => entry.suffix))]
  return {
    count: rejected.length,
    files: rejected.map(({ path, suffix }) => `\`${isWithinDir(path, nuxt.options.rootDir) ? relative(nuxt.options.rootDir, path) : path}\` (\`.${suffix}\`)`).join('\n  - '),
    suffixes: suffixes.map(suffix => `\`'${suffix}'\``).join(', '),
  }
}

/**
 * Find the suffixes Nitro v3 rejects in the names of scanned server files. With `keep`,
 * they are added to `scanSuffixes`, as Nitro v2 kept them as part of the name; otherwise
 * they are reported, and Nitro's own error stands.
 *
 * Returns a callback that handles files added during development; call it once the nitro
 * instance exists.
 */
export async function setupScanSuffixes (nuxt: Nuxt, nitroConfig: NitroConfig, keep: boolean): Promise<(nitro: Pick<Nitro, 'options' | 'hooks'>) => void> {
  const parse = await loadParseScanPath()
  if (!parse) {
    return () => {}
  }

  const rootDir = nitroConfig.rootDir || nuxt.options.rootDir
  const scanDirs = [...new Set([nitroConfig.serverDir, ...nitroConfig.scanDirs || []].filter((dir): dir is string => typeof dir === 'string').map(dir => resolve(rootDir, dir)))]
  const rejected = findRejectedScanSuffixes(nuxt, { ...nitroConfig, scanDirs }, parse)
  if (rejected.length > 0) {
    if (keep) {
      nitroConfig.scanSuffixes = [...new Set([...nitroConfig.scanSuffixes || [], ...rejected.map(entry => entry.suffix)])]
      nitroBuildDiagnostics.NUXT_B9013(describe(nuxt, rejected))
    } else {
      nitroBuildDiagnostics.NUXT_B9014(describe(nuxt, rejected))
    }
  }

  return (nitro) => {
    if (!nuxt.options.dev) {
      return
    }
    const reported = new Set(rejected.map(entry => entry.path))
    nuxt.hook('builder:watch', async (event, relativePath) => {
      if (event !== 'add') {
        return
      }
      const path = resolve(nuxt.options.srcDir, relativePath)
      if (reported.has(path) || !hasSuffix(path)) {
        return
      }
      const file = toScannedFile(nuxt, nitro.options, path)
      const suffix = file && rejectedSuffix(parse, nitro.options.scanSuffixes, file)
      if (!suffix) {
        return
      }
      reported.add(path)
      if (!keep) {
        nitroBuildDiagnostics.NUXT_B9014(describe(nuxt, [{ path, suffix }]))
        return
      }
      nitro.options.scanSuffixes.push(suffix)
      nitroBuildDiagnostics.NUXT_B9013(describe(nuxt, [{ path, suffix }]))
      // Nitro may have scanned the file before the suffix was added
      await nitro.hooks.callHook('build:reload')
    })
  }
}
