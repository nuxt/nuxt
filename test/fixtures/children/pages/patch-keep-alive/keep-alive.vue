<template>
  <div>
    keep-alive
  </div>
</template>

<script>
export default {
  name: 'KeepAlive',
  layout: 'patch-keep-alive',
  asyncData({ route, redirect }) {
    const instance = route.matched[0].instances.default
    if (!instance) return
    const { keepAlive } = instance.$vnode.data
    const { name } = instance.$options
    if (name !== 'KeepAlive' || !keepAlive) return
    redirect({ query: { multiple: 'happened' } })
  }
}
</script>
