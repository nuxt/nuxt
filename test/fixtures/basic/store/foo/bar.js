export const state = () => {
  return {
    baz: 'Vuex Nested Modules'
  }
}

export const getters = {
  baz (state) {
    return state.baz
  }
}
