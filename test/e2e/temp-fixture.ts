import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'pathe'
import { positionIn } from '../fixture-copy'

/** Copies under `fixtures-temp` that suites rewrite while they run, mapped to their source fixture. */
export const tempFixtures = {
  'hmr': 'hmr',
  'hmr-sibling-layer': 'hmr-sibling-layer',
  'dev-error-overlay': 'dev-error-sourcemap',
  'dev-error-recovery': 'dev-error-sourcemap',
  'dev-error-compile': 'dev-error-sourcemap',
} as const

export type TempFixture = keyof typeof tempFixtures

export function tempFixtureDir (name: TempFixture): string {
  return fileURLToPath(new URL(`../fixtures-temp/${name}`, import.meta.url))
}

/** Checkouts on Windows have CRLF line endings, which the patterns tests match on do not. */
function readNormalised (path: string): string {
  return readFileSync(path, 'utf8').replaceAll('\r\n', '\n')
}

/**
 * A fixture copy under `fixtures-temp` that a suite can rewrite while it runs.
 * `restore()` puts back every file the suite changed and removes the ones it created.
 */
export function useTempFixture (name: TempFixture) {
  const fixtureDir = tempFixtureDir(name)
  const originals = new Map<string, string | undefined>()

  function remember (file: string): string {
    const path = join(fixtureDir, file)
    if (!originals.has(file)) {
      originals.set(file, existsSync(path) ? readNormalised(path) : undefined)
    }
    return path
  }

  function read (file: string): string {
    return readNormalised(remember(file))
  }

  function write (file: string, contents: string): void {
    writeFileSync(remember(file), contents)
  }

  function remove (file: string): void {
    rmSync(remember(file), { force: true })
  }

  function restore (): void {
    for (const [file, contents] of originals) {
      const path = join(fixtureDir, file)
      const current = existsSync(path) ? readNormalised(path) : undefined
      if (current === contents) { continue }
      if (contents === undefined) {
        rmSync(path, { force: true })
      } else {
        writeFileSync(path, contents)
      }
    }
  }

  /** 1-based position of `needle` in `file`, as it appears in a stack frame. */
  function positionOf (file: string, needle: string): { line: number, column: number } {
    return positionIn(read(file), file, needle)
  }

  /** Replace `needle` in `file`, failing loudly when the fixture no longer contains it. */
  function replace (file: string, needle: string, replacement: string): void {
    const contents = read(file)
    if (!contents.includes(needle)) {
      throw new Error(`\`${needle}\` is no longer in \`${file}\`; update the fixture or the test`)
    }
    write(file, contents.replace(needle, replacement))
  }

  return { fixtureDir, positionOf, read, remove, replace, restore, write }
}
