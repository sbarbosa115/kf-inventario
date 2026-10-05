import type {Schema} from '@/shared/api';

export type Country = Schema<'CountryOutput'>;
export type State = Schema<'StateOutput'>;
export type City = Schema<'CityOutput'>;

/** What a select shows: an existing place (an id) or a name the person typed that does not exist yet (id null). */
export interface PlaceOption {
  id: number | null;
  name: string;
}

type Id = number | string | null | undefined;

const isDefined = (value: Id): value is number | string =>
  value !== undefined && value !== null;

/**
 * The countries → states → cities tree, as the three cascading selects of an address read it (the port of the
 * legacy LocationManager). A place that is new has no id, so nothing hangs below it.
 */
export class LocationManager {
  constructor(private readonly locations: Country[]) {}

  countries(): Country[] {
    return this.locations;
  }

  states(): State[] {
    return this.locations.flatMap((country) => country.states);
  }

  cities(): City[] {
    return this.states().flatMap((state) => state.cities);
  }

  statesByCountryId(countryId: Id): State[] {
    if (!isDefined(countryId)) return [];
    return this.locations
      .filter((country) => country.id === Number(countryId))
      .flatMap((country) => country.states);
  }

  citiesByState(stateId: Id): City[] {
    if (!isDefined(stateId)) return [];
    return this.states()
      .filter((state) => state.id === Number(stateId))
      .flatMap((state) => state.cities);
  }

  countryById(id: Id, newName?: string): PlaceOption | undefined {
    if (!isDefined(id)) return {id: null, name: newName ?? ''};
    return this.locations.find((country) => country.id === Number(id));
  }

  stateById(id: Id, newName?: string): PlaceOption | undefined {
    if (!isDefined(id)) return {id: null, name: newName ?? ''};
    return this.states().find((state) => state.id === Number(id));
  }

  cityById(id: Id, newName?: string): PlaceOption | undefined {
    if (!isDefined(id)) return {id: null, name: newName ?? ''};
    return this.cities().find((city) => city.id === Number(id));
  }
}
