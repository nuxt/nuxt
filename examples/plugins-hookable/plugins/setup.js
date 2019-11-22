export default function (context, inject, hooks) {
  const hookOrder = []

  inject('loadOrder', [])
  inject('hookOrder', hookOrder)

  hooks.hook('done', () => {
    hookOrder.push('all plugins have finished loading')
  })
}
