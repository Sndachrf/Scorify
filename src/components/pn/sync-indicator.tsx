'use client';

// Indikator sinkronisasi di header (PRD 7.4): Tersinkron / Sinkronisasi / N menunggu / Offline.
// PRD v1.8: tanpa koneksi (build tanpa URL) indikator menampilkan "Data lokal".
// PRD v1.9: tooltip mode data lokal cukup satu kalimat singkat, tanpa penjelasan teknis.
import { useSyncStore } from '@/lib/pn/sync/store';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CloudOff, Cloud, Loader2, AlertTriangle, CheckCircle2, Database } from 'lucide-react';

export function SyncIndicator() {
  const { online, status, pending, lastSync, pesanGagal } = useSyncStore();

  const waktu = lastSync
    ? `Sinkron terakhir: ${new Date(lastSync).toLocaleTimeString('id-ID')}`
    : 'Belum pernah tersinkron';

  let badge: React.ReactNode;
  if (status === 'belum-setup') {
    badge = (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Database className="size-3.5" /> Data lokal
      </Badge>
    );
  } else if (!online) {
    badge = (
      <Badge variant="secondary" className="gap-1">
        <CloudOff className="size-3.5" /> Offline{pending > 0 ? ` · ${pending} menunggu` : ''}
      </Badge>
    );
  } else if (status === 'menyinkron') {
    badge = (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="size-3.5 animate-spin" /> Sinkronisasi…
      </Badge>
    );
  } else if (status === 'gagal') {
    badge = (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="size-3.5" /> Sinkron gagal
      </Badge>
    );
  } else if (pending > 0) {
    badge = (
      <Badge variant="secondary" className="gap-1">
        <Cloud className="size-3.5" /> {pending} perubahan menunggu
      </Badge>
    );
  } else {
    badge = (
      <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-700">
        <CheckCircle2 className="size-3.5" /> Tersinkron
      </Badge>
    );
  }

  const tooltip =
    status === 'gagal' && pesanGagal
      ? `${pesanGagal}. Akan dicoba ulang otomatis.`
      : status === 'belum-setup'
        ? 'Semua data tersimpan di perangkat ini.'
        : waktu;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{badge}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-64 text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
