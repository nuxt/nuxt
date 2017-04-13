import Vue from 'vue'
import { ApolloClient, createNetworkInterface } from 'apollo-client'
import 'isomorphic-fetch'

// Created with Graphcool - https://www.graph.cool/
const API_ENDPOINT = 'https://api.graph.cool/simple/v1/cj1dqiyvqqnmj0113yuqamkuu'

const apolloClient = new ApolloClient({
  networkInterface: createNetworkInterface({
    uri: API_ENDPOINT,
    transportBatching: true
  })
})

export default apolloClient
