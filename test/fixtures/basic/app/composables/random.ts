export function useRandomState (max = 100, name = 'default') {
  return useState('random:' + name, () => Math.round(Math.random() * max))
}
