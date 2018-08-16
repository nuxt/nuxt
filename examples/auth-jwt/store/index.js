import Vuex from 'vuex'

const cookieparser = require('cookieparser')

const createStore = () => {
  return new Vuex.Store({
    state: {
      auth: null
    },
    mutations: {
      update(state, data) {
        state.auth = data
      }
    },
    actions: {
      nuxtServerInit({ commit }, { req }) {
        let accessToken = null
        if (req.headers.cookie) {
          const parsed = cookieparser.parse(req.headers.cookie)
          accessToken = JSON.parse(parsed.auth)
        }
        commit('update', accessToken)
      }
    }
  })
}

export default createStore
