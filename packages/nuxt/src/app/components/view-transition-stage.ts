import { Fragment, Suspense, defineComponent, h } from 'vue'
import type { PropType } from 'vue'
import type { PendingViewTransition } from '../view-transitions'
import { markPendingViewTransitionReady, preparePendingViewTransition } from '../view-transitions'

/**
 * waits before the new page replaces the old one.
 *
 * while the destination loads in the sibling Suspense below, this keeps the current
 * page visible. Once Nuxt and the browser are ready to animate the change, the swap
 * can proceed. This component itself renders nothing on screen.
 *
 * @internal
 */
const ViewTransitionGate = defineComponent({
  name: 'NuxtViewTransitionGate',
  props: {
    session: {
      type: Object as PropType<PendingViewTransition>,
      required: true,
    },
  },
  async setup (props) {
    await preparePendingViewTransition(props.session)
    return () => null
  },
})

export const ViewTransitionStage = defineComponent({
  name: 'NuxtViewTransitionStage',
  props: {
    session: {
      type: Object as PropType<PendingViewTransition>,
      required: true,
    },
  },
  setup (props, { slots }) {
    return () => h(Fragment, [
      // This is mounted before the inner boundary so the outer Suspense stays
      // pending even when the destination page resolves synchronously.
      h(ViewTransitionGate, { session: props.session }),
      h(Suspense, {
        suspensible: false,
        onResolve: () => markPendingViewTransitionReady(props.session),
      }, {
        default: () => slots.default?.(),
      }),
    ])
  },
})
