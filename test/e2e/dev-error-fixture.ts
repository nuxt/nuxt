import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'pathe'
import { positionIn } from '../fixture-copy'

/**
 * A copy of `fixtures/dev-error-sourcemap` under `fixtures-temp`, so a suite can rewrite
 * files while it runs. `restore()` puts back everything the suite touched.
 */
export function useDevErrorFixture (name: string) {
  const fixtureDir = fileURLToPath(new URL(`../fixtures-temp/${name}`, import.meta.url))
  const originals = new Map<string, string>()

  function read (file: string): string {
    const path = join(fixtureDir, file)
    // checkouts on Windows have CRLF line endings, which the patterns tests match on do not
    const contents = readFileSync(path, 'utf8').replaceAll('\r\n', '\n')
    if (!originals.has(file)) {
      originals.set(file, contents)
    }
    return contents
  }

  function write (file: string, contents: string): void {
    read(file)
    writeFileSync(join(fixtureDir, file), contents)
  }

  function restore (): void {
    for (const [file, contents] of originals) {
      writeFileSync(join(fixtureDir, file), contents)
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

  return { fixtureDir, positionOf, read, replace, restore, write }
}
