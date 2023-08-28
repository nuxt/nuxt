<template>
  <div>
    ServerWithClient.server.vue :
    <p>count: {{ count }}</p>

    This is not interactive
    <SugarCounter :multiplier="1" />

    <div class="interactive-component-wrapper" style="border: solid 1px red;">
      The component bellow is not a slot but declared as interactive

      <SugarCounter nuxt-client :multiplier="1" />
    </div>
  </div>
</template>

<script setup lang="ts">
const count = ref(0)
</script>
