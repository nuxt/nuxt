import { initDB, checkUsers } from "../js/dbutils.js"

export default async function() {
  console.log("Initialising module")
  let db = await initDB()

  await checkUsers(db)

  this.nuxt.hook("vue-renderer:ssr:prepareContext", ssrContext => {
    ssrContext.$db = db
  })
}
