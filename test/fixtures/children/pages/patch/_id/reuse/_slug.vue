<template>
  <div>
    <h4>
      _slug: <i data-date-slug>
        {{ date }}
      </i>
    </h4>
  </div>
</template>

<script>
export default {
  watchParam: false,
  asyncData () {
    return {
      date: Date.now()
    }
  }
}
</script>
