export const state = () => ({
  id: "",
  users: []
})

export const getters = {
  getIdMode(state) {
    return {
      id: state.id,
      isCpMode: state.isCpMode
    }
  }
}

export const mutations = {
  setUsers(state, users) {
    state.users = users
  }
}

export const actions = {
  async nuxtServerInit({ commit }, { ssrContext }) {
    let users = ssrContext.$db.getCollection("users")
    console.log(`Loading Vuex Store SSR ,  ${users.count()} entries`)

    commit("setUsers", users.data)
  }
}
