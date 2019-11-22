
export default function ({ app: { $loadOrder, $hookOrder } }, inject, hooks) {
  $loadOrder.push('first')

  hooks.hook('injected:second', (value) => {
    $hookOrder.push(`second was injected with value: ${value}`)
  })

  hooks.hook('loaded', async () => {
    await hooks.callHook('this-is-my-custom-hook')
  })
}
