<script setup lang="ts">
const props = defineProps({
  bool: Boolean,
  number: Number,
  str: String,
  obj: Object,
})
console.log(props)
const hasRouter = useState('hasRouter', () => !!useRouter())
</script>

<template>
  <div>
    Was router enabled: {{ hasRouter }}
    <br>
    Props:
    <!-- eslint-disable-next-line vue/no-v-html -->
    <pre v-html="JSON.stringify(props, null, 2)" />
    <Counter
      v-load-client
      :multiplier="props.number || 5"
    >
      <div>
        Slot content.
        <div>
          This Counter is not loaded client side

          <Counter :multiplier="props.number || 3" />
        </div>
        <div>
          This Counter is loaded client side
          <Counter
            v-load-client
            :multiplier="props.number || 3"
          />
        </div>
      </div>
    </Counter>
  </div>
</template>

<style scoped>
pre {
  color: blue
}
</style>
