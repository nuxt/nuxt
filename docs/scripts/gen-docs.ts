import { rm, writeFile } from 'fs/promises'
import mkdirp from 'mkdirp'
import type { Schema } from 'untyped'
import { join, resolve } from 'pathe'
import { kebabCase, upperFirst } from 'scule'

export async function main () {
  const rootDir = resolve(__dirname, '..')
  const configDir = resolve(rootDir, 'content/5.config')
  await generateDocs({ outDir: configDir })
}

function generateMarkdown (schema: Schema, title: string, level: string, parentVersions: string[] = []) {
  const lines: string[] = []

  // Skip private
  if (schema.tags?.includes('@private')) {
    return []
  }

  // Versions
  const versions = (schema.tags || []).map(t => t.match(/@version (\d+)/)?.[1]).filter(Boolean)
  if (!versions.length) {
    // Inherit from parent if not specified
    versions.push(...parentVersions)
  }
  if (!versions.includes('3')) {
    return []
  }

  // Render heading
  lines.push(`${level} ${title}`, '')

  // Render meta info
  if (schema.type !== 'object' || !schema.properties) {
    // Type and default
    lines.push(`- **Type**: \`${schema.type}\``)
    lines.push(`- **Version**: ${versions.join(', ')}`)
    if ('default' in schema) {
      lines.push('- **Default**', ...formatValue(schema.default))
    }
    lines.push('')
  }

  // Render title
  if (schema.title) {
    lines.push('> ' + schema.title, '')
  }

  // Render description
  if (schema.description) {
    lines.push(schema.description, '')
  }

  // Render @ tags
  if (schema.tags) {
    lines.push(...schema.tags.map(renderTag).flat())
  }

  // Render properties
  if (schema.type === 'object') {
    const keys = Object.keys(schema.properties || {}).sort()
    for (const key of keys) {
      const val = schema.properties[key] as Schema
      const propLines = generateMarkdown(val, `\`${key}\``, level + '#', versions)
      if (propLines.length) {
        lines.push('', ...propLines)
      }
    }
  }

  return lines
}

const TAG_REGEX = /^@([\d\w]+)[\s\n]/i

const TagAlertType = {
  note: 'note',
  warning: 'warning',
  deprecated: 'deprecated'
}

const InternalTypes = new Set([
  'version',
  'deprecated'
])

function formatValue (val) {
  return ['```json', JSON.stringify(val, null, 2), '```']
}

function renderTag (tag: string) {
  const type = tag.match(TAG_REGEX)?.[1]
  if (!type) {
    return [`<!-- ${tag} -->`]
  }
  if (InternalTypes.has(type)) {
    return []
  }
  tag = tag.replace(`@${type}`, `**${upperFirst(type)}**:`)
  if (TagAlertType[type]) {
    return [`::alert{type="${TagAlertType[type]}"}`, tag, '::', '']
  }
  return tag
}

async function generateDocs ({ outDir }) {
  // Prepare content directory
  const start = Date.now()
  console.log('Generating docs to ' + outDir)
  await rm(outDir, { recursive: true }).catch(() => {})
  await mkdirp(outDir)

  const rootSchema = require('@nuxt/kit/schema/config.schema.json') as Schema

  const keys = Object.keys(rootSchema.properties).sort()
  let ctor = 1

  // Generate a separate file for each section
  for (const key of keys) {
    const schema = rootSchema.properties[key]

    const lines = generateMarkdown(schema, key, '#')

    // Skip empty sections
    if (lines.length < 3) {
      continue
    }

    // Add frontmatter meta
    const attributes = Object.entries({
      title: key,
      description: schema.title
    }).map(([key, val]) => `${key}: "${val}"`)

    lines.unshift('---', ...attributes, '---')

    await writeFile(join(outDir, `${ctor++}.${kebabCase(key)}.md`), lines.join('\n'))
  }

  const frontmatter = ['---', 'navigation:', '  collapse: true', '---']
  await writeFile(join(outDir, 'index.md'), frontmatter.join('\n'))

  console.log(`Generate done in ${(Date.now() - start) / 1000} seconds!`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
