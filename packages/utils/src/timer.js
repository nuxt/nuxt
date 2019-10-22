async function promiseFinally (fn, finalFn) {
  let result
  try {
    if (typeof fn === 'function') {
      result = await fn()
    } else {
      result = await fn
    }
  } finally {
    finalFn()
  }
  return result
}

export const timeout = function timeout (fn, ms, msg) {
  let timerId
  const warpPromise = promiseFinally(fn, () => clearTimeout(timerId))
  const timerPromise = new Promise((resolve, reject) => {
    timerId = setTimeout(() => reject(new Error(msg)), ms)
  })
  return Promise.race([warpPromise, timerPromise])
}

export const waitFor = function waitFor (ms) {
  return new Promise(resolve => setTimeout(resolve, ms || 0))
}
export class Timer {
  constructor () {
    this._times = new Map()
  }

  start (name, description) {
    const time = {
      name,
      description,
      start: this.hrtime()
    }
    this._times.set(name, time)
    return time
  }

  end (name) {
    if (this._times.has(name)) {
      const time = this._times.get(name)
      time.duration = this.hrtime(time.start)
      this._times.delete(name)
      return time
    }
  }

  hrtime (start) {
    const useBigInt = typeof process.hrtime.bigint === 'function'
    if (start) {
      const end = useBigInt ? process.hrtime.bigint() : process.hrtime(start)
      return useBigInt
        ? (end - start) / BigInt(1000000)
        : (end[0] * 1e3) + (end[1] * 1e-6)
    }
    return useBigInt ? process.hrtime.bigint() : process.hrtime()
  }

  clear () {
    this._times.clear()
  }
}
