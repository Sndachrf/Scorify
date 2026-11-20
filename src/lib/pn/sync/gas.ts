// Klien HTTP ke Google Apps Script Web App (PRD 5: klien-GAS).
// POST dengan content-type text/plain untuk menghindari preflight CORS GAS.
import type { MutateOp, Snapshot } from '../types';

export interface GasResponse {
  ok: boolean;
  error?: string;
  data?: Snapshot;
  applied?: number;
}

async function gasCall(url: string, body: Record<string, unknown>): Promise<GasResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as GasResponse;
  if (!json.ok) throw new Error(json.error || 'GAS mengembalikan error');
  return json;
}

export function pingGas(url: string) {
  return gasCall(url, { action: 'ping' });
}

export function loadSnapshot(url: string) {
  return gasCall(url, { action: 'load' });
}

export function pushMutate(url: string, ops: MutateOp[]) {
  return gasCall(url, { action: 'mutate', ops });
}
