
export default function ({ app: { $loadOrder, $hookOrder } }, inject, hooks) {
  $loadOrder.push('third')
}
