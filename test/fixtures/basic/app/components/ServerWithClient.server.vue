<template>
  <div>
    ServerWithClient.server.vue :
    <p>count: {{ count }}</p>

    This component should not be preloaded
    <ComponentWithRef />

    This is not interactive
    <Counter :multiplier="1" />

    <div
      class="interactive-component-wrapper"
      style="border: solid 1px red;"
    >
      The component below is not a slot but declared as interactive

      <Counter
        nuxt-client
        :multiplier="1"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const count = ref(0)
</script>
