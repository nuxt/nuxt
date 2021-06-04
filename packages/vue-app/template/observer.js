// Inspired by: https://github.com/nuxt/image/blob/dev/src/runtime/utils/observer.ts

let observerInstance
let observerIdCtr = 1
const OBSERVER_ID_KEY = '__nuxt_prefetch_observer__'

function get () {
  if (typeof IntersectionObserver === 'undefined') {
    return false
  }

  if (observerInstance) {
    return observerInstance
  }

  const onIntersect = (entries) => {
    entries.forEach(({ intersectionRatio, target: link }) => {
      if (intersectionRatio <= 0 || !link.__prefetch) {
        return
      }
      link.__prefetch()
      remove(link) // Prefetching multiple times is not necessary
    })
  }
  const intersectObserver = new IntersectionObserver(onIntersect)

  const remove = (el) => {
    if (!el[OBSERVER_ID_KEY]) { return }
    delete el[OBSERVER_ID_KEY]
    intersectObserver.unobserve(el)
  }

  const add = (el) => {
    el[OBSERVER_ID_KEY] = el[OBSERVER_ID_KEY] || ++observerIdCtr
    intersectObserver.observe(el)
  }

  observerInstance = { add, remove }
  return observerInstance
}

function use (el) {
  const observer = get()
  observer.add(el)
  if (!observer) {
    return false
  }
  return () => observer.remove(el)
}

export function createObserver () {
  return {
    get,
    use
  }
}
