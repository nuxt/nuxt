import sinon from 'sinon'

const getContext = t => { return t.context ? t.context : t }

export function release(t) {
  const context = getContext(t)

  if (context.log) {
    console.log = context.log // eslint-disable-line no-console
  }
  if (context.info) {
    console.info = context.info // eslint-disable-line no-console
  }
  if (context.warn) {
    console.warn = context.warn // eslint-disable-line no-console
  }
  if (context.error) {
    console.error = context.error // eslint-disable-line no-console
  }
}

export async function intercept(t, types, msg, cb) {
  const context = getContext(t)

  if (cb === undefined && typeof msg === 'function') {
    cb = msg
    msg = undefined

    if (typeof types === 'string') {
      msg = types
      types = undefined
    }
  }

  if (cb === undefined && msg === undefined && typeof types === 'function') {
    cb = types
    types = undefined
  }

  const all = types === undefined || types === {}
  const { log, info, warn, error } = types || {}

  if (log || all) {
    context.log = console.log // eslint-disable-line no-console
    console.log = sinon.spy() // eslint-disable-line no-console
  }

  if (info || all) {
    context.info = console.info // eslint-disable-line no-console
    console.info = sinon.spy() // eslint-disable-line no-console
  }

  if (warn || all) {
    context.warn = console.warn // eslint-disable-line no-console
    console.warn = sinon.spy() // eslint-disable-line no-console
  }

  if (error || all) {
    context.error = console.error // eslint-disable-line no-console
    console.error = sinon.spy() // eslint-disable-line no-console
  }

  if (cb) {
    if (msg) {
      process.stdout.write(`  ${msg}`)
    }

    await cb()

    if (msg) {
      process.stdout.write('\n')
    }

    release(context)
  }
}

export async function interceptLog(t, msg, cb) {
  await intercept(t, { log: true }, msg, cb)
}

export async function interceptInfo(t, msg, cb) {
  await intercept(t, { info: true }, msg, cb)
}

export async function interceptWarn(t, msg, cb) {
  await intercept(t, { warn: true }, msg, cb)
}

export async function interceptError(t, msg, cb) {
  await intercept(t, { error: true }, msg, cb)
}
