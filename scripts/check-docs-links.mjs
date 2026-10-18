// Internal docs links must not carry a version segment: nuxt.com inserts the
// segment of the branch a page was built from, so version-less links survive
// cherry-picks between branches. Deliberate cross-version links use a full URL.
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const VERSIONED_INTERNAL_LINK = /(["'(=])\/docs\/\d+\.x\//g

async function walk (dir) {
  const files = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walk(path))
    } else if (entry.name.endsWith('.md')) {
      files.push(path)
    }
  }
  return files
}

const errors = []

for (const file of (await walk('docs')).sort()) {
  const lines = (await readFile(file, 'utf8')).split('\n')
  for (const [index, line] of lines.entries()) {
    for (const match of line.matchAll(VERSIONED_INTERNAL_LINK)) {
      errors.push(`${file}:${index + 1}: remove the version segment from \`${match[0].slice(1)}…\` (or use a full https://nuxt.com URL if you mean another version's docs)`)
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
