import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

export interface DiagnosticEntry {
  why: string
  file: string
  line: number
}

export type DiagnosticCodes = Map<string, DiagnosticEntry>

export interface DiagnosticDrift {
  code: string
  why: string
  otherWhy: string
  file: string
  line: number
}

const CODE_WHY_RE = /\b(NUXT_[A-Z]\d{4}):\s*\{\s*why:\s*([^\n]*)/g

export function extractCodes (sources: Record<string, string>): DiagnosticCodes {
  const codes: DiagnosticCodes = new Map()
  for (const [file, source] of Object.entries(sources)) {
    if (!source.includes('defineDiagnostics(')) {
      continue
    }
    for (const match of source.matchAll(CODE_WHY_RE)) {
      const line = source.slice(0, match.index).split('\n').length
      codes.set(match[1]!, { why: match[2]!.trim(), file, line })
    }
  }
  return codes
}

/**
 * Returns the codes that `head` adds or rewords relative to `base` and that `other` defines
 * with a different meaning.
 */
export function findDrift (base: DiagnosticCodes, head: DiagnosticCodes, other: DiagnosticCodes): DiagnosticDrift[] {
  const drift: DiagnosticDrift[] = []
  for (const [code, entry] of head) {
    if (base.get(code)?.why === entry.why) {
      continue
    }
    const otherWhy = other.get(code)?.why
    if (otherWhy !== undefined && otherWhy !== entry.why) {
      drift.push({ code, why: entry.why, otherWhy, file: entry.file, line: entry.line })
    }
  }
  return drift
}

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function git (...args: string[]) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'] })
}

export function readCodes (ref: string): DiagnosticCodes {
  const files = git('grep', '-l', 'defineDiagnostics(', ref, '--', 'packages/*/src/**.ts')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(file => file.slice(ref.length + 1))
  return extractCodes(Object.fromEntries(files.map(file => [file, git('show', `${ref}:${file}`)])))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { BASE_REF, HEAD_REF = 'HEAD', OTHER_REF } = process.env
  if (!BASE_REF || !OTHER_REF) {
    throw new Error('BASE_REF and OTHER_REF are required')
  }
  const drift = findDrift(readCodes(BASE_REF), readCodes(HEAD_REF), readCodes(OTHER_REF))
  for (const { code, why, otherWhy, file, line } of drift) {
    const message = `${code} is defined here as ${why}\nbut on ${OTHER_REF} as ${otherWhy}\nPick an unused code, or match the diagnostic on ${OTHER_REF}.`
    console.debug(`::error file=${file},line=${line},title=${code} means something else on ${OTHER_REF}::${message.replaceAll('%', '%25').replaceAll('\n', '%0A')}`)
  }
  if (drift.length) {
    process.exitCode = 1
  } else {
    console.debug(`No diagnostic codes changed here conflict with ${OTHER_REF}.`)
  }
}
