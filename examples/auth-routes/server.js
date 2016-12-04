const Nuxt = require('nuxt')
const bodyParser = require('body-parser')
const cookieSession = require('cookie-session')
const app = require('express')()

// Body parser, to access req.body
app.use(bodyParser.json())

// Sessions with cookies to have req.session
app.use(cookieSession({
  name: 'nuxt-session',
  keys: ['nuxt-key-1', 'nuxt-key-2'],
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}))

// POST /api/login to log in the user and add him to the req.session.authUser
app.post('/api/login', function (req, res) {
  if (req.body.username === 'demo' && req.body.password === 'demo') {
    req.session.authUser = { username: 'demo' }
    return res.json({ username: 'demo' })
  }
  res.status(401).json({ error: 'Bad credentials' })
})

app.use(function (req, res, next) {
  req.session.views = (req.session.views || 0) + 1
  next()
})

app.all('/', function (req, res) {
  console.log(req.session)
  res.send('Hello')
})

new Nuxt()
.then((nuxt) => {
  app.use(nuxt.render)
  // app.use(function (req, res) {
  //   nuxt.render(req, res)
  // })
  // .then((stream) => {
  //   stream.pipe(fs.createFile)
  // })
  app.listen(3000)
  console.log('Server is listening on http://localhost:3000')
})
.catch((error) => {
  console.error(error)
  process.exit(1)
})
