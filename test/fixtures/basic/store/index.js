import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export const state = () => ({
  counter: 1
})

export const mutations = {
  increment (state) {
    state.counter++
  }
}
