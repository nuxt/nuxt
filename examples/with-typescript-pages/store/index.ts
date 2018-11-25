import { MutationTree } from 'vuex'

export const state = () => ({ count: 0 })

export const mutations: MutationTree<State> = {
  increment(state) {
    state.count++
  },
  decrement(state) {
    state.count--
  }
}

interface State {
  count: number;
}
