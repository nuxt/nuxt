console.log("API INITIAL ================================================== ")
import express from "express"
// Create express router
const router = express.Router()

// Transform req & res to have the same API as express
// So we can use res.status() & res.json()
const app = express()
router.use((req, res, next) => {
  Object.setPrototypeOf(req, app.request)
  Object.setPrototypeOf(res, app.response)
  req.res = res
  res.req = req
  next()
})

const Loki = require("lokijs")
const db = new Loki("quickstart.db", {
  autoload: true,
  autoloadCallback: () => {
    let entries = db.getCollection("users")
    if (entries === null) {
      entries = db.addCollection("users")
    }

    // kick off any program logic or start listening to external events
    const entryCount = db.getCollection("users").count()
    // eslint-disable-next-line no-console
    console.log("API number of users in database : " + entryCount)
  },
  autosave: true,
  autosaveInterval: 4000
})

// Get list of users via GET - /api/users
router.get("/users", (req, res) => {
  const users = db.getCollection("users")
  console.log("getting list")
  if (users) {
    return res.json(users.data)
  }
  res.status(400).json({
    message: "Not initialised"
  })
})

router.get("/users/:id", (req, res) => {
  const users = db.getCollection("users")
  console.log("getting user", req.params.id)
  const user = users.get(req.params.id)
  if (!user) {
    res.status(404).json({
      message: "User not found"
    })
  } else {
    res.json(user)
  }
})

// Add user via POST - /api/users
router.post("/users", (req, res) => {
  const users = db.getCollection("users")
  console.log("adding user", req.body)
  const user = req.body
  if (user && users) {
    users.insert([user])
    res.json({
      ok: true
    })
  } else
    res.status(400).json({
      message: "Not initialised"
    })
})

// Edit user via  PUT - /api/users
router.put("/users/:id", (req, res) => {
  const users = db.getCollection("users")
  console.log("editing user", req.params, req.body)
  const user = req.body
  const userToChange = users.get(req.params.id)
  if (!userToChange) {
    res.status(404).json({
      message: "User no found"
    })
  } else if (user && users) {
    users.update(user)
    res.json({
      ok: true
    })
  } else
    res.status(400).json({
      message: "NOt initialised"
    })
})

// Add DELETE - /api/logout
router.delete("/users/:id", (req, res) => {
  console.log("deleting user", req.params)
  const users = db.getCollection("users")
  const user = users.get(req.params.id)
  users.remove(user)
  res.json({
    ok: true
  })
})

// Export the server middleware
export default {
  path: "/api",
  handler: router
}
