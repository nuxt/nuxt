const commands = {
  default: () => import('./dev'),
  start: () => import('./start'),
  dev: () => import('./dev'),
  build: () => import('./build'),
  generate: () => import('./generate'),
  help: () => import('./help')
}

export default function getCommand(name) {
  if (!commands[name]) {
    return Promise.resolve(null)
  }
  return commands[name]().then(m => m.default)
}
