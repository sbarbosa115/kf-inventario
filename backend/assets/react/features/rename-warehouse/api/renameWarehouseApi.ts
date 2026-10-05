import {apiPut, type Schema} from '@/shared/api';

export type Warehouse = Schema<'WarehouseOutput'>;

/** The request body (the schema has none): the new name. */
export function renameWarehouse(id: number, name: string): Promise<Warehouse> {
  return apiPut<Warehouse>(`/warehouses/${id}`, {name});
}
