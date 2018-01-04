import * as root from "./root";
import * as people from "./modules/people";

// more info about store: https://vuex.vuejs.org/en/core-concepts.html
// structure of the store:
    // types: Types that represent the keys of the mutations to commit
    // state: The information of our app, we can get or update it.
    // getters: Get complex information from state
    // action: Sync or async operations that commit mutations
    // mutations: Modify the state

export const modules = {
    [people.name]: people
};

interface ModulesStates {
    people: people.State;
}

export type RootState = root.State & ModulesStates;

export const state = root.state;
export const getters = root.getters;
export const actions = root.actions;
export const mutations = root.mutations;