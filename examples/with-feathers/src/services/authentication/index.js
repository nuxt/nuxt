import authentication from 'feathers-authentication'

export default function () {
  const app = this

  let config = app.get('auth')

  app.configure(authentication(config))
}
