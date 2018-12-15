<template>
  <div class="Content">
    <div class="container">
      <h1 class="Content__Title">
        {{ $t('about.title') }}
      </h1>
      <p>{{ $t('about.introduction') }}</p>
    </div>
  </div>
</template>

<script>
export default {
  head() {
    return { title: this.$t('about.title') }
  }
}
</script>
