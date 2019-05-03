export const sequence = function sequence(tasks, fn) {
  // map은 하나하나 매핑해서 함수를 실행하는데, reduce의 경우는 array element를 하나로 퉁쳐서 리턴함
  return tasks.reduce(
    // Promise.resolve()는 reduce 돌릴 때 최초 인자
    (promise, task) => promise.then(() => fn(task)), Promise.resolve()
  )
}

export const parallel = function parallel(tasks, fn) {
  return Promise.all(tasks.map(fn))
}

export const chainFn = function chainFn(base, fn) {
  if (typeof fn !== 'function') {
    return base
  }
  return function (...args) {
    if (typeof base !== 'function') {
      return fn.apply(this, args)
    }
    let baseResult = base.apply(this, args)
    // Allow function to mutate the first argument instead of returning the result
    if (baseResult === undefined) {
      [baseResult] = args
    }
    const fnResult = fn.call(
      this,
      baseResult,
      ...Array.prototype.slice.call(args, 1)
    )
    // Return mutated argument if no result was returned
    if (fnResult === undefined) {
      return baseResult
    }
    return fnResult
  }
}
