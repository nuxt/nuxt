<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div>
    <component
      :is="'x-status-panel'"
      v-bind="$attrs"
    >
      forwarded attrs
    </component>
  </div>
</template>
