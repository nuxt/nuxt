<template>
  <Nuxt />
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'

@Component({
  middleware: 'test'
})
export default class DefaultLayout extends Vue {}
</script>
