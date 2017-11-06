export default {
  name: 'nuxt-child',
  functional: true,
  render (h, { parent, data }) {
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

    return h('transition', {
      props: transitionProps,
      on: listeners
    }, [
      h('router-view', data)
    ])
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
