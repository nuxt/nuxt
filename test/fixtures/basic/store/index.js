export const state = () => ({
  counter: 1,
  meta: [],
  initialized: false
})

export const mutations = {
  increment(state) {
    state.counter++
  },
  setMeta(state, meta) {
    state.meta = meta
  },
  initClient(state) {
    state.initialized = true
  }
}

export const actions = {
  nuxtClientInit({ commit, state }, { route }) {
    if (route.query.onClientInit === '1') {
      commit('initClient')
    }
  }
}
