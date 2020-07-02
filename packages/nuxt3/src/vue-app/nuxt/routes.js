const Index = () => import('~/pages' /* webpackChunkName: "Home" */)
const About = () => import('~/pages/about' /* webpackChunkName: "About" */)
const Custom = () => import('~/pages/custom' /* webpackChunkName: "Custom" */)

export default [
  {
    path: '',
    __file: '@/pages/index.vue',
    component: Index
  },
  {
    path: '/about',
    component: About
  },
  {
    path: '/custom',
    component: Custom
  }
]
