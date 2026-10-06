import {apiPost, type Schema} from '@/shared/api';

/** Approves every incoming row of the warehouse; answers how many were approved. */
export function approveIncoming(
  warehouseId: number,
): Promise<Schema<'ApprovedOutput'>> {
  return apiPost<Schema<'ApprovedOutput'>>(
    `/warehouses/${warehouseId}/incoming/approve`,
    {},
  );
}
