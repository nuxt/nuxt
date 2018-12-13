<template>
  <div>
    {{ message }}
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'

@Component({
  middleware: 'test'
})
export default class PageIndex extends Vue {
  message = 'Index Page'
}
</script>
