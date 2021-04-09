import type { RequestListener } from 'http'

export function createServer () {
  const listener = createDynamicFunction <RequestListener>((_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=UTF-8')
    res.end('<!DOCTYPE html><html><head><meta http-equiv="refresh" content="1"><head><body>...')
  })

  async function listen (opts) {
    const { listen } = await import('listhen')
    return listen(listener.call, opts)
  }

  return {
    setApp: (app: RequestListener) => listener.set(app),
    listen
  }
}

function createDynamicFunction<T extends (...args) => any>(initialValue: T) {
  let fn: T = initialValue
  return {
    set: (newFn: T) => { fn = newFn },
    call: ((...args) => fn(...args)) as T
  }
}
