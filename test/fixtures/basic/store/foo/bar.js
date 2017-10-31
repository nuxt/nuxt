export const state = () => ({
  baz: 'Vuex Nested Modules'
})

export const getters = {
  baz(state) {
    return state.baz
  }
}
