import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Schema } from 'untyped'
import { resolve } from 'pathe'
import { upperFirst } from 'scule'

export async function main () {
  const rootDir = resolve(__dirname, '..')
  const configTemplate = resolve(__dirname, 'nuxt-config.md')
  const configFile = resolve(rootDir, 'content/1.docs/3.api/6.configuration/nuxt-config.md')
  await generateDocs({ configFile, configTemplate })
}

function generateMarkdown (schema: Schema, title: string, level: string) {
  const lines: string[] = []

  // Skip private
  if (schema.tags?.includes('@private')) {
    return []
  }

  // Render heading
  lines.push(`${level} ${title}`, '')

  // Render meta info
  if (schema.type !== 'object' || !schema.properties) {
    // Type and default
    if (schema.type !== 'any') {
      lines.push(`- **Type**: \`${schema.type}\``)
    }
    const defaultValue = formatValue(schema.default)
    if (defaultValue && defaultValue.length) {
      if (defaultValue.length === 1) {
        lines.push(`- **Default:** ${defaultValue[0]}`)
      } else {
        lines.push('- **Default**', ...defaultValue)
      }
    }

    // lines.push(`- **Version**: ${versions.join(', ')}`)

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
      const propLines = generateMarkdown(val, `\`${key}\``, level + '#')
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
  const stringified = JSON.stringify(val, null, 2)
  if (!stringified || stringified === '{}' || stringified === '[]') { return null }
  if (stringified.includes('\n')) {
    return ['```json', stringified, '```']
  } else {
    return ['`' + stringified + '`']
  }
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

async function generateDocs ({ configFile, configTemplate }) {
  const GENERATE_KEY = '<!-- GENERATED_CONFIG_DOCS -->'
  // Prepare content directory
  const start = Date.now()
  console.log(`Updating docs on ${configFile}`)
  const template = await readFile(configTemplate, 'utf8')
  const rootSchema = require('../../packages/schema/schema/config.schema.json') as Schema
  const keys = Object.keys(rootSchema.properties).sort()
  let generatedDocs = ''

  if (!template.includes(GENERATE_KEY)) {
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

  const body = template.replace(GENERATE_KEY, generatedDocs)
  await mkdir(dirname(configFile), { recursive: true })
  await writeFile(configFile, body)

  console.log(`Generate done in ${(Date.now() - start) / 1000} seconds!`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
