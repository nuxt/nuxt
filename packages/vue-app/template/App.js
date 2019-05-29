import Vue from 'vue'
<% if (loading) { %>import NuxtLoading from '<%= (typeof loading === "string" ? loading : "./components/nuxt-loading.vue") %>'<% } %>
<%if (buildIndicator) { %>import NuxtBuildIndicator from './components/nuxt-build-indicator'<% } %>
<% css.forEach((c) => { %>
import '<%= relativeToBuild(resolvePath(c.src || c, { isStyle: true })) %>'
<% }) %>

<%= Object.keys(layouts).map((key) => {
  if (splitChunks.layouts) {
    return `const _${hash(key)} = () => import('${layouts[key]}'  /* webpackChunkName: "${wChunk('layouts/' + key)}" */).then(m => m.default || m)`
  } else {
    return `import _${hash(key)} from '${layouts[key]}'`
  }
}).join('\n') %>

const layouts = { <%= Object.keys(layouts).map(key => `"_${key}": _${hash(key)}`).join(',') %> }<%= isTest ? '// eslint-disable-line' : '' %>

<% if (splitChunks.layouts) { %>let resolvedLayouts = {}<% } %>

export default {
  <%= isTest ? '/* eslint-disable quotes, semi, indent, comma-spacing, key-spacing, object-curly-spacing, space-before-function-paren  */' : '' %>
  head: <%= serializeFunction(head) %>,
  <%= isTest ? '/* eslint-enable quotes, semi, indent, comma-spacing, key-spacing, object-curly-spacing, space-before-function-paren */' : '' %>
  render(h, props) {
    <% if (loading) { %>const loadingEl = h('NuxtLoading', { ref: 'loading' })<% } %>
    const layoutEl = h(this.layout || 'nuxt')
    const templateEl = h('div', {
      domProps: {
        id: '__layout'
      },
      key: this.layoutName
    }, [ layoutEl ])

    const transitionEl = h('transition', {
      props: {
        name: '<%= layoutTransition.name %>',
        mode: '<%= layoutTransition.mode %>'
      },
      on: {
        beforeEnter(el) {
          // Ensure to trigger scroll event after calling scrollBehavior
          window.<%= globals.nuxt %>.$nextTick(() => {
            window.<%= globals.nuxt %>.$emit('triggerScroll')
          })
        }
      }
    }, [ templateEl ])

    return h('div', {
      domProps: {
        id: '<%= globals.id %>'
      }
    }, [<% if (loading) { %>loadingEl, <% } %><%if (buildIndicator) { %>h(NuxtBuildIndicator), <% } %>transitionEl])
  },
  data: () => ({
    isOnline: true,
    layout: null,
    layoutName: ''
  }),
  beforeCreate() {
    Vue.util.defineReactive(this, 'nuxt', this.$options.nuxt)
  },
  created() {
    // Add this.$nuxt in child instances
    Vue.prototype.<%= globals.nuxt %> = this
    // add to window so we can listen when ready
    if (process.client) {
      window.<%= globals.nuxt %> = <%= (globals.nuxt !== '$nuxt' ? 'window.$nuxt = ' : '') %>this
      this.refreshOnlineStatus()
      // Setup the listeners
      window.addEventListener('online', this.refreshOnlineStatus)
      window.addEventListener('offline', this.refreshOnlineStatus)
    }
    // Add $nuxt.error()
    this.error = this.nuxt.error
  },
  <% if (loading) { %>
  mounted() {
    this.$loading = this.$refs.loading
  },
  watch: {
    'nuxt.err': 'errorChanged'
  },
  <% } %>
  computed: {
    isOffline() {
      return !this.isOnline
    }
  },
  methods: {
    refreshOnlineStatus() {
      if (process.client) {
        if (typeof window.navigator.onLine === 'undefined') {
          // If the browser doesn't support connection status reports
          // assume that we are online because most apps' only react
          // when they now that the connection has been interrupted
          this.isOnline = true
        } else {
          this.isOnline = window.navigator.onLine
        }
      }
    },
    <% if (loading) { %>
    errorChanged() {
      if (this.nuxt.err && this.$loading) {
        if (this.$loading.fail) this.$loading.fail()
        if (this.$loading.finish) this.$loading.finish()
      }
    },
    <% } %>
    <% if (splitChunks.layouts) { %>
    setLayout(layout) {
      <% if (debug) { %>
      if(layout && typeof layout !== 'string') throw new Error('[nuxt] Avoid using non-string value as layout property.')
      <% } %>
      if (!layout || !resolvedLayouts['_' + layout]) layout = 'default'
      this.layoutName = layout
      let _layout = '_' + layout
      this.layout = resolvedLayouts[_layout]
      return this.layout
    },
    loadLayout(layout) {
      const undef = !layout
      const nonexistent = !(layouts['_' + layout] || resolvedLayouts['_' + layout])
      let _layout = '_' + ((undef || nonexistent) ? 'default' : layout)
      if (resolvedLayouts[_layout]) {
        return Promise.resolve(resolvedLayouts[_layout])
      }
      return layouts[_layout]()
        .then((Component) => {
          resolvedLayouts[_layout] = Component
          delete layouts[_layout]
          return resolvedLayouts[_layout]
        })
        .catch((e) => {
          if (this.<%= globals.nuxt %>) {
            return this.<%= globals.nuxt %>.error({ statusCode: 500, message: e.message })
          }
        })
    }
    <% } else { %>
    setLayout(layout) {
      <% if (debug) { %>
      if(layout && typeof layout !== 'string') throw new Error('[nuxt] Avoid using non-string value as layout property.')
      <% } %>
      if (!layout || !layouts['_' + layout]) {
        layout = 'default'
      }
      this.layoutName = layout
      this.layout = layouts['_' + layout]
      return this.layout
    },
    loadLayout(layout) {
      if (!layout || !layouts['_' + layout]) {
        layout = 'default'
      }
      return Promise.resolve(layouts['_' + layout])
    }
    <% } %>
  },
  components: {
    <%= (loading ? 'NuxtLoading' : '') %>
  }
}
