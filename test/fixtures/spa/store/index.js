export const state = () => ({
  initialized: false
})

export const mutations = {
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
