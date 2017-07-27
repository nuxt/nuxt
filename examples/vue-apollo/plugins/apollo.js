import 'babel-polyfill'
import Vue from 'vue'
import VueApollo from 'vue-apollo'
import { ApolloClient, createNetworkInterface } from 'apollo-client'


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

Vue.use(VueApollo)
Vue.mixin({apolloProvider})

export default apolloProvider
