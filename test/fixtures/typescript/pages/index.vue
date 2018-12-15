<template>
  <div>{{ message }}</div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'

@Component({
  name: 'Index'
})
export default class extends Vue {
  message: string = 'Index Page'
}
</script>
