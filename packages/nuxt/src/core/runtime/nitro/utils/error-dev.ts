import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import consola from 'consola'
import { ErrorParser } from 'youch-core'
import { Youch } from 'youch'
import { SourceMapConsumer } from 'source-map'
import type { H3Event } from 'h3'

export async function logError (event: H3Event, url: URL, error: any) {
  // Load stack trace with source maps
  await loadStackTrace(error).catch(consola.error)

  // https://github.com/poppinss/youch
  const youch = new Youch()

  const tags = [error.unhandled && '[unhandled]', error.fatal && '[fatal]'].filter(Boolean).join(' ')

  const columns = process.stderr.columns
  const ansiError = (await youch.toANSI(error)).replaceAll(process.cwd(), '.')
  if (!columns) {
    process.stderr.columns = columns
  }

  consola.error(`[nuxt] [request error] ${tags} [${event.method}] ${url}\n\n`, ansiError)
}

// ---- Source Map support ----

export async function loadStackTrace (error: any) {
  if (!(error instanceof Error)) {
    return
  }
  const parsed = await new ErrorParser()
    .defineSourceLoader(sourceLoader)
    .parse(error)

  const stack =
    error.message +
    '\n' +
    parsed.frames.map(frame => fmtFrame(frame)).join('\n')

  Object.defineProperty(error, 'stack', { value: stack })

  if (error.cause) {
    await loadStackTrace(error.cause).catch(consola.error)
  }
}

type SourceLoader = Parameters<ErrorParser['defineSourceLoader']>[0]
type StackFrame = Parameters<SourceLoader>[0]
async function sourceLoader (frame: StackFrame) {
  if (!frame.fileName || frame.fileType !== 'fs' || frame.type === 'native') {
    return
  }

  if (frame.type === 'app') {
    const rawSourceMap = await readFile(`${frame.fileName}.map`, 'utf8').catch(() => {})
    if (rawSourceMap) {
      const consumer = await new SourceMapConsumer(rawSourceMap)
      const originalPosition = consumer.originalPositionFor({ line: frame.lineNumber!, column: frame.columnNumber! })
      if (originalPosition.source && originalPosition.line) {
        frame.fileName = resolve(dirname(frame.fileName), originalPosition.source)
        frame.lineNumber = originalPosition.line
        frame.columnNumber = originalPosition.column || 0
      }
    }
  }

  const contents = await readFile(frame.fileName, 'utf8').catch(() => {})
  return contents ? { contents } : undefined
}

function fmtFrame (frame: StackFrame) {
  if (frame.type === 'native') {
    return frame.raw
  }
  const src = `${frame.fileName || ''}:${frame.lineNumber}:${frame.columnNumber})`
  return frame.functionName ? `at ${frame.functionName} (${src}` : `at ${src}`
}
