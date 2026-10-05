import {apiGet} from '@/shared/api';
import type {Country} from '../lib/location';

/** Every country with its states and their cities. */
export function listLocations(): Promise<Country[]> {
  return apiGet<Country[]>('/locations');
}
