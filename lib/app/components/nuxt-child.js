export default {
  name: 'nuxt-child',
  functional: true,
  props: ['keepAlive'],
  render (h, { parent, data, props }) {
    data.nuxtChild = true
    const _parent = parent
    const transitions = parent.$nuxt.nuxt.transitions
    const defaultTransition = parent.$nuxt.nuxt.defaultTransition

    let depth = 0
    while (parent) {
      if (parent.$vnode && parent.$vnode.data.nuxtChild) {
        depth++
      }
      parent = parent.$parent
    }
    data.nuxtChildDepth = depth
    const transition = transitions[depth] || defaultTransition
    let transitionProps = {}
    transitionsKeys.forEach((key) => {
      if (typeof transition[key] !== 'undefined') {
        transitionProps[key] = transition[key]
      }
    })
    let listeners = {}
    listenersKeys.forEach((key) => {
      if (typeof transition[key] === 'function') {
        listeners[key] = transition[key].bind(_parent)
      }
    })
    // Add triggerScroll event on beforeEnter (fix #1376)
    let beforeEnter = listeners.beforeEnter
    listeners.beforeEnter = (el) => {
      window.$nuxt.$emit('triggerScroll')
      if (beforeEnter) return beforeEnter.call(_parent, el)
    }

    let routerView = [
      h('router-view', data)
    ]
    if (typeof props.keepAlive !== 'undefined') {
      routerView = [
        h('keep-alive', routerView)
      ]
    }
    return h('transition', {
      props: transitionProps,
      on: listeners
    }, routerView)
  }
}

const transitionsKeys = [
  'name',
  'mode',
  'appear',
  'css',
  'type',
  'duration',
  'enterClass',
  'leaveClass',
  'appearClass',
  'enterActiveClass',
  'enterActiveClass',
  'leaveActiveClass',
  'appearActiveClass',
  'enterToClass',
  'leaveToClass',
  'appearToClass'
]

const listenersKeys = [
  'beforeEnter',
  'enter',
  'afterEnter',
  'enterCancelled',
  'beforeLeave',
  'leave',
  'afterLeave',
  'leaveCancelled',
  'beforeAppear',
  'appear',
  'afterAppear',
  'appearCancelled'
]
