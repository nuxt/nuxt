import { promises as fsp } from 'node:fs'
import process from 'node:process'
import { resolve } from 'pathe'
import { glob } from 'tinyglobby'
import { coerce, getMajor, getMinor, getPatch } from 'verkit'

/**
 * Placeholder for a version that is not known at authoring time.
 *
 * Contributors cannot know which release will carry their change - or whether it will be
 * backported to another release line - so they write `unreleased` and the release that ships it
 * stamps the concrete version. Because every release line stamps its own branch, the same
 * markdown resolves to `4.6` on `4.x` and `3.21` on `3.x`.
 */
export const UNRELEASED_VERSION = 'unreleased'

/** Documentation sources that carry version badge placeholders */
const DOCS_GLOB = 'docs/**/*.md'
/** Framework sources that carry `@since` placeholders */
const SOURCE_GLOB = 'packages/*/src/**/*.{ts,mts,vue}'

/** `:versionBadge{version="unreleased"}`, including the whitespace that separates it from the text before it */
const BADGE_RE = /[^\S\r\n]*:versionBadge\{([^}]*)\}/g
/**
 * Code fences and inline code spans, where a badge is the syntax being documented rather than a
 * badge to stamp - the contribution guide explains the placeholder using it.
 */
const FENCE_RE = /^[^\S\r\n]*([`~]{3,})/
const INLINE_CODE_RE = /`[^`\n]*`/g
const BADGE_VERSION_RE = new RegExp(`(?<=\\bversion=)(['"])${UNRELEASED_VERSION}\\1`)
const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---/
const MINIMAL_VERSION_RE = new RegExp(`^minimalVersion:[^\\S\\r\\n]*(['"]?)${UNRELEASED_VERSION}\\1[^\\S\\r\\n]*(\\r?\\n|$)`, 'm')
const SINCE_RE = new RegExp(`(@since[^\\S\\r\\n]+)${UNRELEASED_VERSION}\\b`, 'g')

function parseRelease (release: string) {
  const version = coerce(release)
  if (!version) {
    throw new Error(`Cannot resolve version placeholders for invalid version: ${release}`)
  }
  return version
}

/**
 * The version a badge should name once `release` ships, or `undefined` when the badge should
 * be dropped entirely.
 *
 * - `4.6.0` -> `4.6`, the usual case: a feature released in a minor
 * - `4.5.2` -> `4.5.2`: releases are cut from the branch tip, so a patch can ship a feature
 *   too, and `4.5` would promise it to `4.5.0` users who do not have it
 * - `5.0.0` -> `undefined`: a feature present in the first release of a major is the baseline
 *   for the docs of that line, so naming it is noise
 */
export function resolveBadgeVersion (release: string): string | undefined {
  const version = parseRelease(release)
  const [major, minor, patch] = [getMajor(version), getMinor(version), getPatch(version)]

  if (minor === 0 && patch === 0) {
    return undefined
  }

  return patch === 0 ? `${major}.${minor}` : `${major}.${minor}.${patch}`
}

/**
 * The version an `@since` tag should name once `release` ships, always full semver to match the
 * existing tags. Unlike a badge it is never dropped - `@since` documents the API for good - and a
 * prerelease names the version it leads up to (`5.0.0-alpha.1` -> `5.0.0`).
 */
export function resolveSinceVersion (release: string): string {
  const version = parseRelease(release)
  return `${getMajor(version)}.${getMinor(version)}.${getPatch(version)}`
}

/** Apply `stamp` to everything in a line except its inline code spans */
function stampLine (line: string, stamp: (prose: string) => string): string {
  let stamped = ''
  let index = 0

  for (const code of line.matchAll(INLINE_CODE_RE)) {
    stamped += stamp(line.slice(index, code.index)) + code[0]
    index = code.index + code[0].length
  }

  return stamped + stamp(line.slice(index))
}

/** Apply `stamp` to prose only, leaving fenced blocks and inline code spans as they are */
function stampProse (content: string, stamp: (prose: string) => string): string {
  let fence: string | undefined

  return content.split('\n').map((line) => {
    const delimiter = line.match(FENCE_RE)?.[1]

    if (fence) {
      // Inside a fenced block, so only look for the fence that closes it
      if (delimiter?.[0] === fence[0] && delimiter && delimiter.length >= fence.length) {
        fence = undefined
      }
      return line
    }

    if (delimiter) {
      fence = delimiter
      return line
    }

    return stampLine(line, stamp)
  }).join('\n')
}

/** Replace inline `:versionBadge{version="unreleased"}` markers, dropping them when `version` is `undefined` */
function stampBadges (content: string, version: string | undefined): string {
  return stampProse(content, prose => prose.replace(BADGE_RE, (badge, attrs: string) => {
    if (!BADGE_VERSION_RE.test(attrs)) {
      return badge
    }
    return version ? badge.replace(BADGE_VERSION_RE, `"${version}"`) : ''
  }))
}

/** Replace `minimalVersion: unreleased` in the frontmatter, dropping the field when `version` is `undefined` */
function stampFrontmatter (content: string, version: string | undefined): string {
  const frontmatter = content.match(FRONTMATTER_RE)?.[0]
  if (!frontmatter || !MINIMAL_VERSION_RE.test(frontmatter)) {
    return content
  }

  const stamped = frontmatter.replace(MINIMAL_VERSION_RE, (_match, _quote, eol: string) => {
    return version ? `minimalVersion: "${version}"${eol}` : ''
  })

  return content.replace(frontmatter, stamped)
}

/** Resolve every `unreleased` placeholder in a single markdown document */
export function stampDocument (content: string, version: string | undefined): string {
  return stampFrontmatter(stampBadges(content, version), version)
}

/** Resolve every `@since unreleased` tag in a single source file */
export function stampSource (content: string, version: string): string {
  return content.replace(SINCE_RE, `$1${version}`)
}

async function stampFiles (pattern: string, dir: string, stamp: (content: string) => string): Promise<string[]> {
  const files = await glob(pattern, { cwd: dir })
  const stamped: string[] = []

  for (const file of files) {
    const path = resolve(dir, file)
    const content = await fsp.readFile(path, 'utf-8')
    const updated = stamp(content)
    if (updated === content) { continue }

    await fsp.writeFile(path, updated)
    stamped.push(file)
  }

  return stamped
}

/**
 * Resolve every `unreleased` placeholder - documentation version badges and `@since` tags alike -
 * to the version being released.
 *
 * Returns the list of files that changed.
 */
export async function stampUnreleasedVersions (release: string, dir = process.cwd()): Promise<string[]> {
  const badgeVersion = resolveBadgeVersion(release)
  const sinceVersion = resolveSinceVersion(release)

  const stamped = [
    ...await stampFiles(DOCS_GLOB, dir, content => stampDocument(content, badgeVersion)),
    ...await stampFiles(SOURCE_GLOB, dir, content => stampSource(content, sinceVersion)),
  ]

  return stamped.sort()
}
