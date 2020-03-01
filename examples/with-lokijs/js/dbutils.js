export async function initDB({ autosave = false } = {}) {
  let db
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
        console.log("Number of users in database : " + entryCount)
        resolve(entries)
      },
      autosave,
      autosaveInterval: 4000
    })
  })
  console.log(`Async loading Vuex Store,  ${res.data.length} entries`)
  return db
}

export async function checkUsers(db) {
  console.log("Checking if users collection exists and has data")
  let users = db.getCollection("users")
  const entryCount = users.count()

  if (!entryCount) users = createUsers(db)
  console.log(
    "Users initialised: number of users in database : " + users.count()
  )
  return db
}

export function createUsers(db) {
  console.log("Creating collection users")
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
}
