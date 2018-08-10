import Vue from 'vue'

Vue.config.errorHandler = function () {
  document.body.appendChild(document.createTextNode('error handler triggered'))
}
