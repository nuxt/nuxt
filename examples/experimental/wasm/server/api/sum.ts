import { defineLazyEventHandler } from 'h3'

export default defineLazyEventHandler(async () => {
  const { exports: { sum } } = await loadWasmInstance(
    // @ts-ignore
    () => import('~/server/wasm/sum.wasm')
  )

  return (event) => {
    const { a = 0, b = 0 } = getQuery(event)
    return { sum: sum(a, b) }
  }
})

async function loadWasmInstance (importFn, imports = {}) {
  const init = await importFn().then(m => m.default || m)
  const { instance } = await init(imports)
  return instance
}
