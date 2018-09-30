import { createNetworkInterface } from 'apollo-client'

export default (ctx) => {
  // eslint-disable-next-line spellcheck/spell-checker
  return createNetworkInterface({ uri: 'https://api.graph.cool/simple/v1/cj1dqiyvqqnmj0113yuqamkuu' })
}
