import Vue from 'vue'
import VueMq from 'vue-mq'

Vue.use(VueMq, {
  // should always be matching tailwind breakpoints
  breakpoints: {
    xs: 640,
    sm: 768,
    md: 1024,
    lg: 1280,
    xl: Infinity
  },
  defaultBreakpoint: 'lg'
})
