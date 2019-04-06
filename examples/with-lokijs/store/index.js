var db = null
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
  setUSers(state, users) {
    state.users = users
  }
}

export const actions = {
  async nuxtServerInit({ dispatch }) {
    console.log("STARTED SERVER")

    await dispatch("INIT_DB")
  },
  async INIT_DB({ dispatch }) {
    if (process.server) {
      const res = await new Promise(resolve => {
        const Loki = require("lokijs")
        db = new Loki("quickstart.db", {
          autoload: true,
          autoloadCallback: () => {
            let entries = db.getCollection("users")
            if (entries === null) {
              entries = db.addCollection("users")
            }

            // kick off any program logic or start listening to external events
            const entryCount = db.getCollection("users").count()
            // eslint-disable-next-line no-console
            console.log("number of users in database : " + entryCount)
            resolve(entries)
          },
          autosave: false
          // autosaveInterval: 4000
        })
      })
      console.log("async loaded,", res.data)
      await dispatch("LOAD_DB")
    } else {
      console.log(
        "HEYYYYYYYYYYYYWHOOOOOOISCALLLINGGGGGGGGGGGGMEEEEEEEEEEEEE???????"
      )
    }
  },

  CREATE_DB() {
    console.log("creating collection users")
    let users = db.getCollection("users")
    users.insert([
      {
        name: "Thor",
        age: 35
      },
      {
        name: "Loki",
        age: 30
      }
    ])
    console.log("Users added: number of users in database : " + users.count())
    return users
    // if (!state.LegalEntities) {
    //   const { data } = await this.$api.getLegalEntities()
    //   commit("setLegalEntities", data)
    // }
  },
  async LOAD_DB({ dispatch, commit }) {
    console.log("Initialising", process.server)
    let users = db.getCollection("users")
    // if(!users){

    // }
    const entryCount = users.count()

    if (!entryCount) users = await dispatch("CREATE_DB")
    console.log(
      "Users initialising: number of users in database : " + users.count()
    )
    commit("setUSers", users.data)
  }
}
