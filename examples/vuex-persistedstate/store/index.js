import createPersistedState from 'vuex-persistedstate'

export const state = () => ({
  counter: 0
})

export const mutations = {
  increment: (state) => state.counter++,
  decrement: (state) => state.counter--
}

export const plugins = [
  createPersistedState()
]
