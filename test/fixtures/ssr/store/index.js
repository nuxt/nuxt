import { nextId } from '@/lib/db'

export const state = () => {
  return {
    id: nextId(),
    id2: 0
  }
}

export const mutations = {
  setId2(state, id) {
    state.id2 = id
  }
}

export const actions = {
  nuxtServerInit({ commit, state }, { route }) {
    if (route.query.onServerInit === '1') {
      commit('setId2', nextId())
    }
  }
}
