export const state = () => ({
  test: '❌'
})

export const actions = {
  nuxtServerInit ({ state }) {
    state.test = '✅'
  }
}
