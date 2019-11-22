
export default function ({ app: { $loadOrder, $hookOrder } }, inject, hooks) {
  $loadOrder.push('second')

  hooks.hook('this-is-my-custom-hook', () => {
    $hookOrder.push(`first plugin called 'this-is-my-custom-hook'`)
  })

  hooks.hook('loaded', () => {
    inject('second', 'insert this!')
  })
}
