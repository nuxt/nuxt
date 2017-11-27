import axios from "~/plugins/axios";

export const state = () => ({
  selected: 1,
  people: []
});

export const mutations = {
  select(state, id) {
    state.selected = id;
  },
  setPeople(state, people) {
    state.people = people;
  }
};

export const getters = {
  selectedPerson: state => {
    const p = state.people.find(person => person.id === state.selected);
    return p ? p : { first_name: "Please,", last_name: "select someone" };
  }
};

export const actions = {
  async nuxtServerInit({ commit }) {
    const response = await axios.get("/random-data.json");
    const people = response.data.slice(0, 10);
    commit("setPeople", people);
  },
  select({ commit }, id) {
    commit("select", id);
  }
};
