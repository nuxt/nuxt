export const state = () => ({
  babVal: 10
})

export const getters = {
  getBabVal (state) {
    return state.babVal
  }
}
