<template>
  <div class="container">
    <h2>Page without Prop</h2>
    <navigation />
  </div>
</template>

<script>
  import navigation from '@/components/navigation';

  export default {
    components: { navigation },
    layout: (context) => context.route.query.layout || 'default'
  }
</script>
