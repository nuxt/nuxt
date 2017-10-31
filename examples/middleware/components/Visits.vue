<template>
  <ul>
    <li v-for="visit in visits"><i>{{ visit.date | hours }}</i> - {{ visit.path }}</li>
  </ul>
</template>

<script>
export default {
  computed: {
    visits() {
      return this.$store.state.visits.slice().reverse()
    }
  },
  filters: {
    hours(date) {
      return date.split('T')[1].split('.')[0]
    }
  }
}
</script>

<style scoped>
ul {
  position: fixed;
  top: 20px;
  right: 20px;
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: auto;
  list-style-type: none;
}
ul li {
  padding: 2px 0;
}
ul li i {
  color: gray;
  font-style: normal;
}
</style>
