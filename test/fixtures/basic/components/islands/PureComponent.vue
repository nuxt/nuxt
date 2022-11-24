<script setup lang="ts">
const props = defineProps({
  bool: Boolean,
  number: Number,
  str: String,
  obj: Object
})

const hasRouter = useState('hasRouter', () => !!useRouter())
</script>

<template>
  <div>
    Was router enabled: {{ hasRouter }}
    <br>
    Props:
    <!-- eslint-disable-next-line vue/no-v-html -->
    <pre v-html="JSON.stringify(props, null, 2)" />
  </div>
</template>

<style scoped>
pre {
  color: blue
}
</style>
