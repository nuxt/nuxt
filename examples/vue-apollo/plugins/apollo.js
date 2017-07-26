import 'babel-polyfill'
import Vue from 'vue'
import VueApollo from 'vue-apollo'
import { ApolloClient, createNetworkInterface } from 'apollo-client'

Vue.use(VueApollo)

const API_ENDPOINT = 'https://api.graph.cool/simple/v1/cj1dqiyvqqnmj0113yuqamkuu'

const apolloClient = new ApolloClient({
  networkInterface: createNetworkInterface({
    uri: API_ENDPOINT,
    transportBatching: true
  })
})

const apolloProvider = new VueApollo({
  defaultClient: apolloClient
})

export default ({ app, store }) => {
  Object.assign(app, { apolloProvider })
}
