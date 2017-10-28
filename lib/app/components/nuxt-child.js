export default {
  name: 'nuxt-child',
  functional: true,
  render (h, { parent, data }) {
    const nuxt = parent.$root.nuxt
    const component = parent.$route.matched[0].components.default

    const layoutUid = parent._uid
    const layoutName = component.options ? component.options.layout : null

    // If we're changing layout render the stored vnode
    if (nuxt._layoutUid === layoutUid &&
        nuxt._layoutName !== layoutName
    ) {
      return nuxt._childVnode
    }

    nuxt._layoutUid = layoutUid
    nuxt._layoutName = layoutName

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

    nuxt._childVnode = h('transition', {
      props: transitionProps,
      on: listeners
    }, [
      h('router-view', data)
    ])

    return nuxt._childVnode
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
