<template>
  <div>{{ message }}</div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'

@Component
export default class Index extends Vue {
  message: string = 'Index Page'
}
</script>
