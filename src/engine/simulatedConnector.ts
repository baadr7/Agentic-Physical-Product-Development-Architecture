// Generic connector (docs/06). In the demo every read/write is simulated; in
// production the real connector is plugged in and the app does not change.

import { connectorFixtures } from '@/config/connectorFixtures';
import type { ConnectorRequest, ConnectorResponse, ConnectorEvent } from '@/types';

/** Simulated inbound read — returns canned-but-coherent data from fixtures. */
export function simulateRead(request: ConnectorRequest, fixtureKey: keyof typeof connectorFixtures): {
  request: ConnectorRequest;
  response: ConnectorResponse;
} {
  const response = connectorFixtures[fixtureKey];
  return { request, response };
}

export function buildReadRequest(
  connector_id: string,
  query_type: string,
  filters: Record<string, unknown> = {},
  max_results = 10,
): ConnectorRequest {
  return { connector_id, query_type, filters, max_results };
}

/** Simulated outbound write/notify — returns the event envelope (caller appends ADT). */
export function simulateWrite(
  connector_id: string,
  event_type: ConnectorEvent['event_type'],
  payload: Record<string, unknown>,
  adt_entry_id?: string,
): ConnectorEvent {
  return { connector_id, event_type, payload, adt_entry_id };
}
