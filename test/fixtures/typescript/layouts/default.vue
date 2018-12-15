<template>
  <Nuxt />
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'

@Component({
  name: 'DefaultLayout',
  middleware: 'test'
})
export default class extends Vue {}
</script>
