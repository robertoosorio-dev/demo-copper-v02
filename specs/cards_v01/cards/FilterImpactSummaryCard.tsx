import React from 'react';

export type FilterImpactSummaryCardProps = {
  originalRows: number;
  currentRows: number;
  activeFilters: number;
};

const formatNumber = (value: number) => new Intl.NumberFormat().format(value);

export function FilterImpactSummaryCard({ originalRows, currentRows, activeFilters }: FilterImpactSummaryCardProps) {
  const removed = Math.max(0, originalRows - currentRows);
  const pctKept = originalRows > 0 ? Math.round((currentRows / originalRows) * 100) : 0;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Live impact</div>
      <h3 className="mt-1 text-lg font-semibold text-gray-950">Filter impact</h3>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${pctKept}%` }} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Metric label="Active filters" value={formatNumber(activeFilters)} />
        <Metric label="Rows kept" value={`${formatNumber(currentRows)} of ${formatNumber(originalRows)}`} />
        <Metric label="Rows removed" value={formatNumber(removed)} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-950">{value}</div>
    </div>
  );
}

export default FilterImpactSummaryCard;
