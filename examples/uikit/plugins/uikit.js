import Vue from 'vue'
import UIkit from 'uikit'
import Icons from 'uikit/dist/js/uikit-icons'

// loads the Icon plugin
UIkit.use(Icons)

// creates global UIkit variable
Vue.prototype.$uikit = UIkit