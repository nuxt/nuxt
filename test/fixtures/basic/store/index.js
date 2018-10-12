export const state = () => ({
  counter: 1,
  meta: []
})

export const mutations = {
  increment(state) {
    state.counter++
  },
  setMeta(state, meta) {
    state.meta = meta
  }
}
