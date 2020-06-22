export const state = () => ({
  oldFetchData: 'not-set'
})

export const mutations = {
  setOldFetchData (state, data) {
    state.oldFetchData = data
  }
}
