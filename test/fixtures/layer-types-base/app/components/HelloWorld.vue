<script setup lang="ts">
// #35373: all four layer aliases must resolve against this layer's own dir.
import ButtonAt from '@/components/Button.vue'
import ButtonTilde from '~/components/Button.vue'
import ButtonRootTilde from '~~/app/components/Button.vue'
import ButtonRootAt from '@@/app/components/Button.vue'
</script>

<template>
  <ButtonAt label="@" />
  <ButtonTilde label="~" />
  <ButtonRootTilde label="~~" />
  <ButtonRootAt label="@@" />
</template>
