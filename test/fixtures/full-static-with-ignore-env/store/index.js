export const state = () => ({
  counter: 0
})

export const mutations = {
  COUNT (state) {
    state.counter += 1
  }
}
