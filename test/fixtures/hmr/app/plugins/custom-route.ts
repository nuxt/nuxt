export default defineNuxtPlugin(() => {
  const router = useRouter()

  router.addRoute({
    path: '/custom-route',
    name: 'custom-route',
    component: defineComponent({
      render: () => h('div', { 'data-testid': 'custom-route' }, 'Custom route added via plugin'),
    }),
  })
})
