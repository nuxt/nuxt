<template>
  <div class="container">
    <h2>Page with Prop</h2>
    <h3>Foo: {{ foo }}</h3>
    <navigation />
  </div>
</template>

<script>
import navigation from '@/components/navigation'

export default {
  components: { navigation },
  props: ['foo'],
  layout: context => context.route.query.layout || 'default'
}
</script>
