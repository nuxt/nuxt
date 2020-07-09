<template>
  <div>
    {{ test }}
  </div>
</template>

<script>
import _ from 'lodash'
import $ from 'cheerio'

export default {
  data () {
    $('<a>A</a>')
    return {
      test: _.startCase('lodash')
    }
  }
}
</script>
