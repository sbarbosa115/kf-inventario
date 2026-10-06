import {apiGet, type Schema} from '@/shared/api';

export type Warehouse = Schema<'WarehouseOutput'>;

/** Every warehouse, by id (the first one is where the stock screens start). */
export function listWarehouses(): Promise<Warehouse[]> {
  return apiGet<Warehouse[]>('/warehouses');
}
