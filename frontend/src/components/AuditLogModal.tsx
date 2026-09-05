import React from 'react';
import { X, ShieldCheck, Clock, Download } from 'lucide-react';
import type { OperatorAuditEntry } from '../types';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditEntries: OperatorAuditEntry[];
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({
  isOpen,
  onClose,
  auditEntries
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-background-card border border-border w-full max-w-2xl shadow-solid-md flex flex-col max-h-[80vh]">
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

        {/* Modal Body: Table of audit actions */}
        <div className="p-4 overflow-y-auto flex-1 font-mono text-xs">
          {auditEntries.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
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
                      <span className={`font-bold ${
                        entry.newRouteState === 'CRITICAL' ? 'text-rose-400' : 'text-cyan-400'
                      }`}>
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
            onClick={() => alert('Audit log exported to JSON')}
            className="px-2.5 py-1 bg-background-card hover:bg-zinc-800 border border-border text-zinc-200 text-xs flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            EXPORT AUDIT RECORD
          </button>
        </div>
      </div>
    </div>
  );
};
