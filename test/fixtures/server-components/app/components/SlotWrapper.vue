<template>
  <div class="slot-wrapper">
    <SlottedChild v-bind="$attrs">
      <slot />
    </SlottedChild>
  </div>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>
