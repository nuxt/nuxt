import MagicString from 'magic-string'
import { walk } from 'oxc-walker'
import { pascalCase } from 'scule'
import type { ESTree, ParseResult } from 'rolldown/utils'
import { parseModule } from './parse.ts'

interface AnnotationSchema {
  title: string
  description: string
  tags: string[]
  type?: string
  tsType?: string
  markdownType?: string
}

const COMMENT_RE = /\/[*/]/
const WHITESPACE_RE = /\s/

/**
 * Add the `$schema` markup described by the comments in front of each object property:
 *
 * - a property with a plain value becomes `{ $default: value, $schema }`;
 * - an object value gets a `$schema` property, or has the annotations appended to its own
 *   `$schema` object.
 *
 * The output is still TypeScript if the input was, and keeps every line where it was.
 *
 * @param code the source of a schema file, or of a local file it imports
 * @param filename used to infer the language
 */
export function annotateSchemaSource (code: string, filename: string): string {
  if (!COMMENT_RE.test(code)) {
    return code
  }

  const { program, comments, errors } = parseModule(code, filename, { preserveParens: false })
  if (errors.length || !comments.length) {
    return code
  }

  const s = new MagicString(code)
  const commentStarts = new Map(comments.map(comment => [comment.start, comment.end]))

  const skipPastComma = (from: number) => {
    for (let index = from; index < code.length; index++) {
      const commentEnd = commentStarts.get(index)
      if (commentEnd !== undefined) {
        index = commentEnd - 1
      } else if (code[index] === ',') {
        return index + 1
      } else if (!WHITESPACE_RE.test(code[index]!)) {
        return index
      }
    }
    return from
  }

  const commentsBetween = (start: number, end: number) => {
    let low = 0
    let high = comments.length
    while (low < high) {
      const mid = (low + high) >>> 1
      if (comments[mid]!.start < start) {
        low = mid + 1
      } else {
        high = mid
      }
    }
    const found: ParseResult['comments'] = []
    for (let index = low; index < comments.length && comments[index]!.end <= end; index++) {
      found.push(comments[index]!)
    }
    return found
  }

  // nested objects are left before the object containing them, so that where two insertions
  // land on the same offset, the inner one comes first
  walk(program, {
    leave (node) {
      if (node.type !== 'ObjectExpression') {
        return
      }
      for (const [index, property] of node.properties.entries()) {
        if (property.type !== 'Property' || property.kind !== 'init' || property.method) {
          continue
        }
        const start = index === 0 ? node.start + 1 : skipPastComma(node.properties[index - 1]!.end)
        const leading = commentsBetween(start, property.start)
        if (leading.length) {
          annotateProperty(s, code, property, parseJSDocs(leading.filter(comment => comment.type === 'Block').map(comment => comment.value)))
        }
      }
    },
  })

  return s.hasChanged() ? s.toString() : code
}

function annotateProperty (s: MagicString, code: string, property: ESTree.ObjectProperty, schema: AnnotationSchema) {
  const value = property.value as ESTree.Expression
  const node = value.type === 'TSAsExpression' || value.type === 'TSTypeAssertion' ? value.expression : value

  if (node.type !== 'ObjectExpression') {
    const markup = `, $schema: ${JSON.stringify(schema)} }`
    if (property.shorthand) {
      s.appendLeft(property.end, `: { $default: ${code.slice(value.start, value.end)}${markup}`)
    } else {
      s.appendLeft(value.start, '{ $default: (')
      s.appendLeft(value.end, `)${markup}`)
    }
    return
  }

  const schemaProperty = node.properties.find((prop): prop is ESTree.ObjectProperty => prop.type === 'Property' && prop.key.type === 'Identifier' && prop.key.name === '$schema')
  if (!schemaProperty || schemaProperty.kind !== 'init' || schemaProperty.method) {
    s.appendLeft(node.start + 1, `$schema: ${JSON.stringify(schema)}, `)
    return
  }
  if (schemaProperty.value.type !== 'ObjectExpression') {
    return
  }
  const entries = JSON.stringify(schema).slice(1, -1)
  const last = schemaProperty.value.properties.at(-1)
  if (last) {
    s.appendLeft(last.end, `, ${entries}`)
  } else {
    s.appendLeft(schemaProperty.value.start + 1, entries)
  }
}

const JSDOC_LINE_RE = /^\s*\*+ |[\s*]+$/g
const TYPEDEF_TAG_RE = /@typedef\s+\{(?<typedef>[\s\S]+)\} (?<alias>.*)/
const TYPE_TAG_RE = /@type\s+\{([\s\S]+)\}/

function parseJSDocs (input: string[]): AnnotationSchema {
  const schema: AnnotationSchema = {
    title: '',
    description: '',
    tags: [],
  }

  const lines = input.flatMap(comment => comment.split('\n').map(line => line.replace(JSDOC_LINE_RE, '')))

  const firstTag = lines.findIndex(line => line.startsWith('@'))
  const comments = clumpLines(lines.slice(0, firstTag === -1 ? undefined : firstTag))

  if (comments.length === 1) {
    schema.title = comments[0]!
  } else if (comments.length > 1) {
    schema.title = comments[0]!
    schema.description = comments.splice(1).join('\n')
  }

  if (firstTag !== -1) {
    const tags = clumpLines(lines.slice(firstTag), ['@'], '\n')
    const typedefs: Record<string, string> = {}
    for (const tag of tags) {
      const { typedef, alias } = tag.match(TYPEDEF_TAG_RE)?.groups || {}
      if (typedef && alias) {
        typedefs[typedef] = alias
      }
    }
    for (const tag of tags) {
      if (tag.startsWith('@type')) {
        const type = tag.match(TYPE_TAG_RE)?.[1]
        if (!type) {
          continue
        }
        Object.assign(schema, getTypeDescriptor(type))
        for (const typedef in typedefs) {
          schema.markdownType = type
          schema.tsType &&= schema.tsType.replace(new RegExp(typedefs[typedef]!, 'g'), typedef)
        }
        continue
      }
      schema.tags.push(tag.trim())
    }
  }

  return schema
}

function containsIncompleteCodeblock (line = '') {
  return !!(line.split('\n').filter(line => line.startsWith('```')).length % 2)
}

function clumpLines (lines: string[], delimiters = [' '], separator = ' ') {
  const clumps: string[] = []
  while (lines.length > 0) {
    const line = lines.shift()!
    if ((line && !delimiters.includes(line[0]!) && clumps.at(-1)) || containsIncompleteCodeblock(clumps.at(-1))) {
      clumps[clumps.length - 1] += separator + line
    } else {
      clumps.push(line)
    }
  }
  return clumps.filter(Boolean)
}

const JS_TYPES = new Set(['string', 'number', 'bigint', 'boolean', 'symbol', 'function', 'object', 'any', 'array'])
const FRIENDLY_TYPE_RE = /(?:typeof )?import\(["'](?<importName>[^"']+)["']\)(?:\[["']|\.)(?<firstType>[^\s"']+)(?:["']\])?/g

function getTypeDescriptor (type: string): Pick<AnnotationSchema, 'type' | 'tsType' | 'markdownType'> {
  let markdownType = type
  for (const match of type.matchAll(FRIENDLY_TYPE_RE)) {
    const { importName, firstType } = match.groups || {}
    if (importName && firstType) {
      markdownType = markdownType.replace(match[0], pascalCase(importName) + pascalCase(firstType))
    }
  }
  return {
    ...(JS_TYPES.has(type) ? { type } : {}),
    tsType: type,
    ...(markdownType === type ? {} : { markdownType }),
  }
}
