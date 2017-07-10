<template>
  <component :is="comp"/>
</template>

<script>
const components = {}
const files = require.context('@/articles', false, /\.vue$/)
files.keys().forEach((filename) => {
  const name = filename.replace('./', '').replace('.vue', '')
  components[name] = () => import('@/articles/' + name + '.vue').then((m) => m.default || m)
})

export default {
  async asyncData({ params, error }) {
    return { comp: params.slug }
  },
  components
}
</script>