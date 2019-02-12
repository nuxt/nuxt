export const state = () => ({
  list: []
})

export const mutations = {
  add(state, { text }) {
    state.list.push({
      text,
      done: false
    })
  },

  toggle(state, todo) {
    todo.done = !todo.done
  }
}

export const getters = {
  todos(state) {
    return state.list
  }
}
