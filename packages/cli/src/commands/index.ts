export const commands = {
  dev: () => import('./dev'),
  build: () => import('./build'),
  usage: () => import('./usage')
}
