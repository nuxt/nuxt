const _commands = {
  start: () => import('./start'),
  serve: () => import('./serve'),
  dev: () => import('./dev'),
  build: () => import('./build'),
  generate: () => import('./generate'),
  export: () => import('./export'),
  webpack: () => import('./webpack'),
  help: () => import('./help')
}

export default function getCommand (name: keyof typeof _commands) {
  if (!_commands[name]) {
    return Promise.resolve(null)
  }
  return _commands[name]().then(m => m.default)
}
