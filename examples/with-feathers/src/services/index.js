import authentication from './authentication'
import user from './user'

export default function () {
  const app = this

  app.configure(authentication)
  app.configure(user)
}
