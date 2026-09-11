import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, Clock, Download, Database, RefreshCw, HardDrive } from 'lucide-react';
import type { OperatorAuditEntry } from '../types';
import { jvalyxApi } from '../services/api';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditEntries: OperatorAuditEntry[];
}

interface OffshoreStatus {
  configured: boolean;
  type: string;
  target_url: string | null;
  local_total: number;
  synced_offshore: number;
  pending_offshore: number;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({
  isOpen,
  onClose,
  auditEntries,
}) => {
  const [offshoreStatus, setOffshoreStatus] = useState<OffshoreStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    jvalyxApi
      .offshoreStatus()
      .then((status) => {
        if (active) setOffshoreStatus(status);
      })
      .catch(() => {
        // offshore status endpoint optional in pure frontend dev
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await jvalyxApi.syncOffshore();
      setOffshoreStatus(res);
    } catch (err) {
      console.error('Failed to trigger offshore sync:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportJson = () => {
    if (auditEntries.length === 0) return;
    const blob = new Blob([JSON.stringify(auditEntries, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jvalyx_audit_export_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-background-card border border-border w-full max-w-2xl shadow-solid-md flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-border bg-background">
          <div className="flex items-center gap-2 font-mono text-sm font-bold text-zinc-100 uppercase">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            OPERATOR AUDIT TRAIL & COMPLIANCE LOG
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Offshore DB Sync Banner */}
        <div className="bg-zinc-950/90 border-b border-border px-4 py-2.5 flex items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>STORAGE:</span>
              <span className="text-emerald-400 font-semibold">SQLite WAL (On-Disk)</span>
            </span>
            <span className="text-zinc-600">|</span>
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-zinc-400">OFFSHORE DB:</span>
              {offshoreStatus?.configured ? (
                <span className="text-cyan-400 font-bold uppercase">
                  {offshoreStatus.type === 'postgresql' ? 'PostgreSQL' : 'Cloud REST'} (
                  {offshoreStatus.synced_offshore} Synced
                  {offshoreStatus.pending_offshore > 0 && `, ${offshoreStatus.pending_offshore} Pending`}
                  )
                </span>
              ) : (
                <span className="text-zinc-500 italic">Not Configured</span>
              )}
            </span>
          </div>

          {offshoreStatus?.configured && (
            <button
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="px-2 py-0.5 bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-800/80 text-cyan-300 text-[11px] flex items-center gap-1 transition-colors disabled:opacity-50"
              title="Force sync pending audit entries to remote cloud database"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'SYNCING...' : 'SYNC NOW'}
            </button>
          )}
        </div>

        {/* Modal Body: Table of audit actions */}
        <div className="p-4 overflow-y-auto flex-1 font-mono text-xs">
          {auditEntries.length === 0 ? (
            <div className="text-center py-10 text-zinc-500">
              No operator actions logged in current session.
            </div>
          ) : (
            <div className="space-y-2.5">
              {auditEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-background border border-border p-3 flex flex-col gap-1.5 hover:border-cyan-500/50 transition-colors"
                >
                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      {entry.timestamp}
                    </span>
                    <span className="font-bold text-zinc-300">OPERATOR: {entry.operator}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-100">
                      EVENT {entry.eventId} — ACTION: <span className="text-cyan-400">{entry.action}</span>
                    </span>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-zinc-500">{entry.priorRouteState}</span>
                      <span>→</span>
                      <span
                        className={`font-bold ${
                          entry.newRouteState === 'CRITICAL' ? 'text-rose-400' : 'text-cyan-400'
                        }`}
                      >
                        {entry.newRouteState}
                      </span>
                    </div>
                  </div>

                  {entry.notes && (
                    <div className="text-[11px] text-zinc-400 border-t border-border/60 pt-1 mt-0.5">
                      {entry.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-background flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <span>ENTRIES: {auditEntries.length} RECORD(S)</span>
          <button
            onClick={handleExportJson}
            disabled={auditEntries.length === 0}
            className="px-2.5 py-1 bg-background-card hover:bg-zinc-800 border border-border text-zinc-200 text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            EXPORT AUDIT RECORD (.JSON)
          </button>
        </div>
      </div>
    </div>
  );
};
