export const initialState = () => ({
  counter: 0
})

export const mutations = {
  increment(state) {
    state.counter += 1
  }
}

export const actions = {
  increment({ commit }) {
    commit('increment')
  }
}
