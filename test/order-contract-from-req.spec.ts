import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkpointKeys, createDefaultCheckpoints } from '../src/orders/order-operations';
import { orderStatuses } from '../src/orders/order-status';

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/0001_initial_schema.sql'), 'utf8');

describe('REQ.md order workflow contract', () => {
  it('uses the planned status sequence from REQ.md', () => {
    expect(orderStatuses).toEqual([
      'draft',
      'awaiting_payment',
      'paid',
      'pickup_scheduled',
      'picked_up',
      'in_model_production',
      'model_ready',
      'in_prosthesis_production',
      'prosthesis_ready',
      'ready_for_delivery',
      'delivery_scheduled',
      'delivered',
      'cancelled'
    ]);
    expect(orderStatuses).not.toContain('in_production');
  });

  it('creates all operational checkpoints from REQ.md', () => {
    expect(checkpointKeys).toEqual([
      'pickup_checkin',
      'pickup_checkout',
      'model_production_start',
      'model_production_done',
      'prosthesis_production_start',
      'prosthesis_production_done',
      'delivery_checkin',
      'delivery_checkout'
    ]);
    expect(createDefaultCheckpoints()).toHaveLength(8);
  });

  it('keeps the Postgres status constraint aligned with REQ.md', () => {
    for (const status of ['in_model_production', 'model_ready', 'in_prosthesis_production', 'prosthesis_ready']) {
      expect(migration).toContain(`'${status}'`);
    }
    expect(migration).not.toContain("'in_production'");
  });
});
