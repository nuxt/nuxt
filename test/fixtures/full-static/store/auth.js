export const state = () => ({
  user: null
})

export const mutations = {
  SET_USER (state, user) {
    state.user = user
  }
}

export const actions = {
  FETCH_USER ({ commit }) {
    commit('SET_USER', {
      name: (process.client ? 'C' : 'S') + ' Æ A-' + (10 + Math.round(Math.random() * 10))
    })
  }
}
