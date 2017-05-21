export const state = () => ({
  list: [
    'Lorem ipsum',
    'dolor sit amet',
    'consetetur sadipscing elitr'
  ]
})

export const mutations = {
  add (state, title) {
    state.list.push(title)
  }
}

export const getters = {
  get (state) {
    return state.list
  }
}
