// @ts-ignore
import { render } from '~runtime/server'

render(process.argv[2] || '/')
  .then(html => console.log(html))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
