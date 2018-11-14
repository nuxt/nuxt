import Vue from 'vue'

Vue.config.errorHandler = function (err) {
  document.body.appendChild(document.createTextNode(`error handler triggered: ${err.message || err}`))
}
