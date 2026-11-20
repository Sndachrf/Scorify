// Status sinkronisasi global (zustand), dipakai indikator di header (PRD 7.4).
import { create } from 'zustand';

export type SyncStatus =
  | 'belum-setup'
  | 'idle'
  | 'menyinkron'
  | 'tersinkron'
  | 'gagal';

interface SyncState {
  online: boolean;
  status: SyncStatus;
  pending: number;
  lastSync: number | null;
  pesanGagal: string | null;
  setOnline: (v: boolean) => void;
  setStatus: (s: SyncStatus) => void;
  setPending: (n: number) => void;
  setLastSync: (ts: number | null) => void;
  setPesanGagal: (msg: string | null) => void;
  patch: (p: Partial<Omit<SyncState, 'setOnline' | 'setStatus' | 'setPending' | 'setLastSync' | 'setPesanGagal' | 'patch'>>) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  status: 'idle',
  pending: 0,
  lastSync: null,
  pesanGagal: null,
  setOnline: (v) => set({ online: v }),
  setStatus: (s) => set({ status: s }),
  setPending: (n) => set({ pending: n }),
  setLastSync: (ts) => set({ lastSync: ts }),
  setPesanGagal: (msg) => set({ pesanGagal: msg }),
  patch: (p) => set(p),
}));
