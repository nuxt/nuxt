const express = require('express')

module.exports = function () {
  // Create express router
  const router = express.Router()

  var app = express()
  // Transform req & res to have the same API as express
  // So we can use res.status() & res.json()
  router.use((req, res, next) => {
    Object.setPrototypeOf(req, app.request)
    Object.setPrototypeOf(res, app.response)
    req.res = res
    res.req = req
    next()
  })

  // Add POST - /api/login
  router.post('/login', (req, res) => {
    if (req.body.username === 'demo' && req.body.password === 'demo') {
      req.session.authUser = { username: 'demo' }
      return res.json({ username: 'demo' })
    }
    res.status(401).json({ message: 'Bad credentials' })
  })

  // Add POST - /api/logout
  router.post('/logout', (req, res) => {
    delete req.session.authUser
    res.json({ ok: true })
  })

  // Add router to /api
  this.addServerMiddleware({
    path: '/api',
    handler: router
  })
}