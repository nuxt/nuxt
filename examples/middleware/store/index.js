export const state = () => ({
  visits: []
})

export const mutations = {
  ADD_VISIT(state, path) {
    state.visits.push({
      path,
      date: new Date().toJSON()
    })
  }
}
