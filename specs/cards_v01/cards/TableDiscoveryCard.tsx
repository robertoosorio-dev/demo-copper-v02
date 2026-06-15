import React from 'react';

export type TableDiscoveryCardProps = {
  tableName: string;
  sourceLabel?: string;
  sourceUrl?: string;
  rows: number;
  columns: number;
  warnings?: number;
  skippedRows?: number;
  isLiveFeed?: boolean;
  status?: 'analyzing' | 'analyzed' | 'error';
  onOpenSource?: () => void;
  onReload?: () => void;
  onDelete?: () => void;
};

const formatNumber = (value: number) => new Intl.NumberFormat().format(value);

export function TableDiscoveryCard({
  tableName,
  sourceLabel,
  sourceUrl,
  rows,
  columns,
  warnings = 0,
  skippedRows,
  isLiveFeed,
  status = 'analyzed',
  onOpenSource,
  onReload,
  onDelete,
}: TableDiscoveryCardProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Table discovered</div>
          <h3 className="mt-1 text-lg font-semibold text-gray-950">{tableName}</h3>
          {sourceLabel && <div className="mt-1 text-sm text-gray-500">{sourceLabel}</div>}
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{status}</span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Metric label="Rows" value={formatNumber(rows)} helper={skippedRows ? `${formatNumber(skippedRows)} skipped empty rows` : undefined} />
        <Metric label="Columns" value={formatNumber(columns)} helper="all detected" />
        <Metric label="Warnings" value={formatNumber(warnings)} helper={warnings ? "won't block import" : 'none'} tone={warnings ? 'warning' : 'default'} />
      </div>

      {isLiveFeed && (
        <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm leading-5 text-gray-600">
          Live feed. This table re-syncs from its source on a schedule, so row count can change as the source changes.
        </p>
      )}

      {sourceUrl && <div className="mt-3 truncate text-xs text-gray-500">{sourceUrl}</div>}

      <div className="mt-5 flex flex-wrap gap-2">
        {onOpenSource && <button className="text-sm font-medium text-blue-700" onClick={onOpenSource}>Open source</button>}
        {onReload && <button className="text-sm font-medium text-blue-700" onClick={onReload}>Reload</button>}
        {onDelete && <button className="text-sm font-medium text-red-600" onClick={onDelete}>Delete</button>}
      </div>
    </section>
  );
}

function Metric({ label, value, helper, tone = 'default' }: { label: string; value: string; helper?: string; tone?: 'default' | 'warning' }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className={tone === 'warning' ? 'mt-1 text-2xl font-semibold text-orange-600' : 'mt-1 text-2xl font-semibold text-gray-950'}>{value}</div>
      {helper && <div className="mt-1 text-xs text-gray-500">{helper}</div>}
    </div>
  );
}

export default TableDiscoveryCard;
