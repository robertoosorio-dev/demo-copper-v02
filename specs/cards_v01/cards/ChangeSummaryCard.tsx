import React from 'react';

export type ChangeLine = {
  id: string;
  op: 'add' | 'modify' | 'remove' | 'warning';
  label: string;
  detail?: string;
};

export type ChangeSummaryCardProps = {
  title: string;
  status?: 'proposed' | 'accepted' | 'rejected' | 'applied' | 'rolled_back';
  why?: string;
  changes: ChangeLine[];
  consequences?: string[];
  warnings?: string[];
  affectedObjects?: string[];
  onAccept?: () => void;
  onReject?: () => void;
  onRollback?: () => void;
  onInspect?: () => void;
};

export function ChangeSummaryCard({ title, status = 'proposed', why, changes, consequences = [], warnings = [], affectedObjects = [], onAccept, onReject, onRollback, onInspect }: ChangeSummaryCardProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Change summary</div>
          <h3 className="mt-1 text-lg font-semibold text-gray-950">{title}</h3>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{status}</span>
      </div>

      {why && <p className="mt-4 text-sm leading-5 text-gray-600"><span className="font-medium text-gray-900">Why: </span>{why}</p>}

      <div className="mt-5 space-y-2">
        {changes.map((change) => (
          <div key={change.id} className="flex gap-3 rounded-lg bg-gray-50 p-3 text-sm">
            <span className={iconClass(change.op)}>{opSymbol(change.op)}</span>
            <div>
              <div className="font-medium text-gray-950">{change.label}</div>
              {change.detail && <div className="mt-1 text-gray-500">{change.detail}</div>}
            </div>
          </div>
        ))}
      </div>

      {warnings.length > 0 && <ListBlock title="Warnings" items={warnings} tone="warning" />}
      {consequences.length > 0 && <ListBlock title="Consequences" items={consequences} />}
      {affectedObjects.length > 0 && <ListBlock title="Affected objects" items={affectedObjects} />}

      <div className="mt-5 flex flex-wrap gap-2">
        {onAccept && <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white" onClick={onAccept}>Accept</button>}
        {onReject && <button className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700" onClick={onReject}>Reject</button>}
        {onRollback && <button className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700" onClick={onRollback}>Rollback</button>}
        {onInspect && <button className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700" onClick={onInspect}>Inspect</button>}
      </div>
    </section>
  );
}

function opSymbol(op: ChangeLine['op']) {
  if (op === 'add') return '+';
  if (op === 'modify') return '~';
  if (op === 'remove') return '-';
  return '!';
}

function iconClass(op: ChangeLine['op']) {
  if (op === 'warning') return 'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700';
  if (op === 'remove') return 'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700';
  return 'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700';
}

function ListBlock({ title, items, tone = 'default' }: { title: string; items: string[]; tone?: 'default' | 'warning' }) {
  return (
    <div className={tone === 'warning' ? 'mt-4 rounded-lg bg-orange-50 p-3' : 'mt-4 rounded-lg bg-gray-50 p-3'}>
      <div className={tone === 'warning' ? 'text-sm font-medium text-orange-800' : 'text-sm font-medium text-gray-900'}>{title}</div>
      <ul className="mt-2 space-y-1 text-sm text-gray-600">
        {items.map((item) => <li key={item}>• {item}</li>)}
      </ul>
    </div>
  );
}

export default ChangeSummaryCard;
