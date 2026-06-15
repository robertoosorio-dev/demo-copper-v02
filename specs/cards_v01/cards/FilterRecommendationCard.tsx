import React from 'react';

export type FilterRecommendationCardProps = {
  title: string;
  reason: string;
  rowsRemoved: number;
  field?: string;
  operator?: string;
  value?: string;
  status?: 'recommended' | 'applied' | 'dismissed';
  onApply?: () => void;
  onDismiss?: () => void;
  onUndo?: () => void;
};

const formatNumber = (value: number) => new Intl.NumberFormat().format(value);

export function FilterRecommendationCard({ title, reason, rowsRemoved, field, operator, value, status = 'recommended', onApply, onDismiss, onUndo }: FilterRecommendationCardProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-950">{title}</h3>
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">AI Recommended</span>
          </div>
          <p className="mt-2 text-sm leading-5 text-gray-600">{reason}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-semibold text-gray-950">-{formatNumber(rowsRemoved)}</div>
          <div className="text-xs uppercase tracking-wide text-gray-500">rows</div>
        </div>
      </div>

      {(field || operator || value) && (
        <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          Rule: {[field, operator, value].filter(Boolean).join(' ')}
        </div>
      )}

      <div className="mt-5 flex gap-2">
        {status === 'applied' && onUndo ? (
          <button className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700" onClick={onUndo}>Undo</button>
        ) : (
          <>
            {onApply && <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white" onClick={onApply}>Apply</button>}
            {onDismiss && <button className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700" onClick={onDismiss}>Dismiss</button>}
          </>
        )}
      </div>
    </section>
  );
}

export default FilterRecommendationCard;
