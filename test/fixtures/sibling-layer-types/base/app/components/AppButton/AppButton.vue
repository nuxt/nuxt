<template>
  <UButton v-bind="forwarded">
    <template
      v-for="(_, name) in $slots"
      #[name]="slotProps"
    >
      <slot
        :name="name"
        v-bind="slotProps ?? {}"
      />
    </template>
  </UButton>
</template>

<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'
import { useForwardPropsEmits } from 'reka-ui'

const props = defineProps<ButtonProps>()
const forwarded = useForwardPropsEmits(props)
</script>
