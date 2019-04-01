
export default function ({ route, redirect }) {
  const redirectPathRegexp = /^\/redirect(\d+)$/
  const match = route.path.match(redirectPathRegexp)

  if (match) {
    const number = parseInt(match[1])
    if (number === 1) {
      redirect('/redirect-done')
    } else {
      redirect(`/redirect${number - 1}`)
    }
  }
}
