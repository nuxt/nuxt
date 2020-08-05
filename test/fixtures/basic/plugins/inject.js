export default ({ route, params }, inject) => {
  const { injectValue } = route.query
  if (typeof injectValue === 'undefined') {
    return
  }
  const key = 'injectedProperty'
  const map = {
    undefined,
    null: null,
    false: false,
    0: 0,
    empty: '',
    foo: 'bar'
  }
  const value = map[injectValue]
  inject(key, value)
}
