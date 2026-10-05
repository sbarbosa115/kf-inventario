import {describe, expect, it} from 'vitest';
import {LocationManager, type Country} from './location';

const LOCATIONS: Country[] = [
  {
    id: 1,
    name: 'Colombia',
    code: 'CO',
    states: [
      {
        id: 10,
        name: 'Antioquia',
        code: 'ANT',
        cities: [
          {id: 100, name: 'Medellin'},
          {id: 101, name: 'Envigado'},
        ],
      },
      {id: 11, name: 'Cundinamarca', code: 'CUN', cities: []},
    ],
  },
  {
    id: 2,
    name: 'Peru',
    code: 'PE',
    states: [
      {id: 20, name: 'Lima', code: 'LIM', cities: [{id: 200, name: 'Lima'}]},
    ],
  },
];

describe('LocationManager', () => {
  const manager = new LocationManager(LOCATIONS);

  it('lists every country, state and city of the tree', () => {
    expect(manager.countries().map((c) => c.name)).toEqual([
      'Colombia',
      'Peru',
    ]);
    expect(manager.states().map((s) => s.name)).toEqual([
      'Antioquia',
      'Cundinamarca',
      'Lima',
    ]);
    expect(manager.cities().map((c) => c.id)).toEqual([100, 101, 200]);
  });

  it('offers only the states of the chosen country, and only the cities of the chosen state', () => {
    expect(manager.statesByCountryId(1).map((s) => s.id)).toEqual([10, 11]);
    expect(manager.citiesByState(10).map((c) => c.name)).toEqual([
      'Medellin',
      'Envigado',
    ]);
    expect(manager.citiesByState(11)).toEqual([]);
  });

  it('offers nothing below a country, state or city that is new (no id yet) or unknown', () => {
    expect(manager.statesByCountryId(null)).toEqual([]);
    expect(manager.statesByCountryId(undefined)).toEqual([]);
    expect(manager.statesByCountryId(999)).toEqual([]);
    expect(manager.citiesByState(null)).toEqual([]);
    expect(manager.citiesByState(999)).toEqual([]);
  });

  it('finds an existing one by id, also when the id arrives as a string', () => {
    expect(manager.countryById(2)?.name).toBe('Peru');
    expect(manager.stateById('11')?.name).toBe('Cundinamarca');
    expect(manager.cityById(101)?.name).toBe('Envigado');
    expect(manager.cityById(999)).toBeUndefined();
  });

  it('gives a name typed by the person an option with id null', () => {
    expect(manager.countryById(null, 'Chile')).toEqual({
      id: null,
      name: 'Chile',
    });
    expect(manager.stateById(undefined, 'Maule')).toEqual({
      id: null,
      name: 'Maule',
    });
    expect(manager.cityById(null, 'Talca')).toEqual({id: null, name: 'Talca'});
  });
});
