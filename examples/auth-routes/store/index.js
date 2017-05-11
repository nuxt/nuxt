import Vue from 'vue'
import Vuex from 'vuex'
import axios from 'axios'

Vue.use(Vuex)

const store = new Vuex.Store({
  state: {
    authUser: null
  },
  mutations: {
    SET_USER: function (state, user) {
      state.authUser = user
    }
  },
  actions: {
    nuxtServerInit ({ commit }, { req }) {
      if (req.session && req.session.authUser) {
        commit('SET_USER', req.session.authUser)
      }
    },
    login ({ commit }, { username, password }) {
      return axios.post('/api/login', {
        username,
        password
      })
      .then((res) => {
        commit('SET_USER', res.data)
      })
      .catch((error) => {
        if (error.response.status === 401) {
          throw new Error('Bad credentials')
        }
      })
    },
    logout ({ commit }) {
      return axios.post('/api/logout')
      .then(() => {
        commit('SET_USER', null)
      })
    }
  }
})

export default store
