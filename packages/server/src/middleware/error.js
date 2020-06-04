import path from 'path'
import fs from 'fs-extra'
import consola from 'consola'

import Youch from '@nuxtjs/youch'

export default ({ resources, options }) => async function errorMiddleware (rawError, req, res, next) {
  // Normalize error
  const err = normalizeStack(rawError, options)

  // ensure statusCode, message and name fields
  const error = {
    statusCode: err.statusCode || 500,
    message: err.message || 'Nuxt Server Error',
    name: !err.name || err.name === 'Error' ? 'NuxtServerError' : err.name,
    headers: err.headers
  }

  const sendResponse = (content, type = 'text/html') => {
    // Set Headers
    res.statusCode = error.statusCode
    res.statusMessage = error.name
    res.setHeader('Content-Type', type + '; charset=utf-8')
    res.setHeader('Content-Length', Buffer.byteLength(content))
    res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate')

    // Error headers
    if (error.headers) {
      for (const name in error.headers) {
        res.setHeader(name, error.headers[name])
      }
    }

    // Send Response
    res.end(content, 'utf-8')
  }

  // Check if request accepts JSON
  const hasReqHeader = (header, includes) =>
    req.headers[header] && req.headers[header].toLowerCase().includes(includes)
  const isJson =
    hasReqHeader('accept', 'application/json') ||
    hasReqHeader('user-agent', 'curl/')

  // Use basic errors when debug mode is disabled
  if (!options.debug) {
    // We hide actual errors from end users, so show them on server logs
    if (err.statusCode !== 404) {
      consola.error(err.stack)
    }

    // Json format is compatible with Youch json responses
    const json = {
      status: error.statusCode,
      message: error.message,
      name: error.name
    }
    if (isJson) {
      sendResponse(JSON.stringify(json, undefined, 2), 'text/json')
      return
    }
    const html = resources.errorTemplate(json)
    sendResponse(html)
    return
  }

  // Show stack trace
  const youch = new Youch(
    err,
    req,
    readSourceFactory({
      srcDir: options.srcDir,
      rootDir: options.rootDir,
      buildDir: options.buildDir
    }),
    options.router.base,
    true
  )
  if (isJson) {
    const json = await youch.toJSON()
    sendResponse(JSON.stringify(json, undefined, 2), 'text/json')
    return
  }

  const html = await youch.toHTML()
  sendResponse(html)
}

const sanitizeName = name => name ? name.replace('webpack:///', '').split('?')[0] : null

const normalizeStack = (_err, { srcDir, rootDir, buildDir }) => {
  const err = (_err instanceof Error || typeof _err === 'string')
    ? new Error(_err)
    : new Error(_err.message || JSON.stringify(_err))

  const searchPath = [
    srcDir,
    rootDir,
    path.join(buildDir, 'dist', 'server'),
    buildDir,
    process.cwd()
  ]

  const findInPaths = (fileName) => {
    for (const dir of searchPath) {
      const fullPath = path.resolve(dir, fileName)
      if (fs.existsSync(fullPath)) {
        return fullPath
      }
    }
    return fileName
  }

  err.stack = (_err.stack || '')
    .split('\n')
    .map((l) => {
      const m = l.match(/\(([^)]+)\)|([^\s]+\.[^\s]+):/)
      if (!m) {
        return l
      }
      const src = m[1] || m[2] || ''
      const s = src.split(':')
      if (s[0]) {
        s[0] = findInPaths(sanitizeName(s[0]))
      }
      return l.replace(src, s.join(':'))
    })
    .join('\n')

  return err
}

const readSourceFactory = ({ rootDir }) => async function readSource (frame) {
  const source = await fs.readFile(frame.fileName, 'utf-8').catch(() => null)
  if (source) {
    frame.contents = source
    if (path.isAbsolute(frame.fileName)) {
      frame.fullPath = frame.fileName
      frame.fileName = path.relative(rootDir, frame.fileName)
    }
  }
}
