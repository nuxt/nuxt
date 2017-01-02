export const state = {
  list: []
}

export const mutations = {
  add (state, { text }) {
    state.list.push({
      text,
      done: false
    })
  },

  delete (state, { todo }) {
    state.list.splice(state.list.indexOf(todo), 1)
  },

  toggle (state, { todo }) {
    todo.done = !todo.done
  }
}
