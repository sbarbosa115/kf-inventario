export default class LocationManager {
  constructor(locations) {
    this.locations = locations;
  }

  static createEmptyAddress() {
    return {
      city: {
        state: {
          country: {},
        },
      },
    };
  }

  static createEmptySelectObject(data) {
    return Object.assign({
      id: null,
      name: 'Empty Country',
    }, data);
  }

  static isDefined(variableToCheck) {
    if (variableToCheck === undefined || variableToCheck === null) {
      return false;
    }
    return true;
  }

  getCountries() {
    return this.locations.map(country => country);
  }

  getStates() {
    return this.locations.flatMap(country => (
      country.states.map(state => (state))
    ));
  }

  getCities() {
    return this.locations.flatMap(country => (
      country.states.flatMap(state => (
        state.cities.map(city => city)
      ))
    ));
  }

  getStatesByCountryId(countryId) {
    return this.locations.filter(country => (country.id === countryId))
      .flatMap(country => country.states);
  }

  getCitiesByState(stateId) {
    return this.getStates().filter(state => (Number(state.id) === Number(stateId)))
      .flatMap(state => state.cities);
  }

  getCountryById(countryId, newCountryName) {
    if (!LocationManager.isDefined(countryId)) {
      return LocationManager.createEmptySelectObject({ name: newCountryName });
    }
    return this.locations.find(country => country.id === Number(countryId));
  }

  getStateById(stateId, newStateName) {
    if (!LocationManager.isDefined(stateId)) {
      return LocationManager.createEmptySelectObject({ name: newStateName });
    }
    return this.getStates().find(state => (state.id === Number(stateId)));
  }

  getCityById(cityId, newCityName) {
    if (!LocationManager.isDefined(cityId)) {
      return LocationManager.createEmptySelectObject({ name: newCityName });
    }
    return this.getCities().find(city => (city.id === Number(cityId)));
  }
}
