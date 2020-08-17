async function promiseFinally<T> (
  fn: (() => Promise<T>) | Promise<T>,
  finalFn: () => any
) {
  let result: T
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

export const timeout = function timeout <T> (
  fn: Promise<T>,
  ms: number,
  msg: string
) {
  let timerId: NodeJS.Timeout
  const warpPromise = promiseFinally(fn, () => clearTimeout(timerId))
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const timerPromise = new Promise((resolve, reject) => {
    timerId = setTimeout(() => reject(new Error(msg)), ms)
  })
  return Promise.race([warpPromise, timerPromise])
}

export const waitFor = function waitFor (ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms || 0))
}

interface Time {
  name: string
  description: string
  start: [number, number] | bigint
  duration?: bigint | [number, number]
}
export class Timer {
  _times: Map<string, Time>

  constructor () {
    this._times = new Map()
  }

  start (name: string, description: string) {
    const time: Time = {
      name,
      description,
      start: this.hrtime()
    }
    this._times.set(name, time)
    return time
  }

  end (name: string) {
    if (this._times.has(name)) {
      const time = this._times.get(name)!
      if (typeof time.start === 'bigint') {
        time.duration = this.hrtime(time.start)
      } else {
        time.duration = this.hrtime(time.start)
      }
      this._times.delete(name)
      return time
    }
  }

  hrtime (start?: bigint): bigint
  hrtime (start?: [number, number]): [number, number]
  hrtime (start?: [number, number] | bigint) {
    const useBigInt = typeof process.hrtime.bigint === 'function'
    if (start) {
      if (typeof start === 'bigint') {
        if (!useBigInt) { throw new Error('bigint is not supported.') }

        const end = process.hrtime.bigint()
        return (end - start) / BigInt(1000000)
      }

      const end = process.hrtime(start)
      return end[0] * 1e3 + end[1] * 1e-6
    }
    return useBigInt ? process.hrtime.bigint() : process.hrtime()
  }

  clear () {
    this._times.clear()
  }
}
