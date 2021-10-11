import { readFile, writeFile } from 'fs/promises'
import type { Schema } from 'untyped'
import { resolve } from 'pathe'
import { upperFirst } from 'scule'

export async function main () {
  const rootDir = resolve(__dirname, '..')
  const configFile = resolve(rootDir, 'content/3.docs/2.directory-structure/15.nuxt.config.md')
  await generateDocs({ configFile })
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
  note: 'info',
  warning: 'warning',
  deprecated: 'danger'
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

async function generateDocs ({ configFile }) {
  const GENERATE_KEY = '<!-- GENERATED_CONFIG_DOCS -->'
  // Prepare content directory
  const start = Date.now()
  console.log(`Updating docs on ${configFile}`)
  const fileContent = await readFile(configFile, 'utf8')
  const generateAt = fileContent.indexOf(GENERATE_KEY)
  const rootSchema = require('@nuxt/kit/schema/config.schema.json') as Schema
  const keys = Object.keys(rootSchema.properties).sort()
  let generatedDocs = ''

  if (generateAt === -1) {
    throw new Error(`Could not find ${GENERATE_KEY} in ${configFile}`)
  }

  // Generate each section
  for (const key of keys) {
    const schema = rootSchema.properties[key]

    const lines = generateMarkdown(schema, key, '##')

    // Skip empty sections
    if (lines.length < 3) {
      continue
    }

    // Add lines to new file content
    generatedDocs += lines.join('\n') + '\n'
  }

  const body = fileContent.slice(0, generateAt + GENERATE_KEY.length) + '\n\n' + generatedDocs
  await writeFile(configFile, body)

  console.log(`Generate done in ${(Date.now() - start) / 1000} seconds!`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
