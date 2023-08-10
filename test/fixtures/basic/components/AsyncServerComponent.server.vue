<template>
  <div>
    This is a .server (20ms) async component
    {{ data }}
    <div id="async-server-component-count">
      {{ count }}
    </div>

    <div style="border: solid 1px red;"> 
      The component bellow is not a slot but declared as interactive
      
    <SugarCounter nuxt-client :multiplier="1" /> 
    </div>
     
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  count: number
}>()

const { data } = await useFetch('/api/very-long-request')
</script>
