import React from 'react';

export type KeySelectionCardProps = {
  keyName: string;
  mode?: 'single' | 'composite';
  isRecommended?: boolean;
  isValid: boolean;
  uniqueValues: number;
  totalValues: number;
  duplicates: number;
  missing: number;
  sampleValues?: string[];
  reason?: string;
  onEdit?: () => void;
  onApply?: () => void;
  onCancel?: () => void;
};

const formatNumber = (value: number) => new Intl.NumberFormat().format(value);

export function KeySelectionCard({ keyName, mode = 'single', isRecommended, isValid, uniqueValues, totalValues, duplicates, missing, sampleValues = [], reason, onEdit, onApply, onCancel }: KeySelectionCardProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Primary key</div>
          <div className="mt-1 flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-950">{keyName}{mode === 'composite' ? ' (Composite key)' : ''}</h3>
            {isRecommended && <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">AI Recommended</span>}
          </div>
          <div className={isValid ? 'mt-1 text-sm text-green-700' : 'mt-1 text-sm text-orange-700'}>{isValid ? 'Fully unique and stable across syncs.' : 'Not valid; review duplicates or missing values.'}</div>
        </div>
        {onEdit && <button className="text-sm font-medium text-blue-700" onClick={onEdit}>Edit</button>}
      </div>

      {reason && <p className="mt-4 text-sm leading-5 text-gray-600">{reason}</p>}

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Metric label="Unique values" value={`${formatNumber(uniqueValues)} / ${formatNumber(totalValues)}`} helper={totalValues ? `${Math.round((uniqueValues / totalValues) * 100)}%` : undefined} />
        <Metric label="Duplicates" value={formatNumber(duplicates)} tone={duplicates ? 'warning' : 'default'} />
        <Metric label="Missing" value={formatNumber(missing)} tone={missing ? 'warning' : 'default'} />
      </div>

      {sampleValues.length > 0 && (
        <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
          <span className="font-medium text-gray-800">Sample values: </span>{sampleValues.join(', ')}
        </div>
      )}

      {(onApply || onCancel) && (
        <div className="mt-5 flex gap-2">
          {onApply && <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white" onClick={onApply}>Apply</button>}
          {onCancel && <button className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700" onClick={onCancel}>Cancel</button>}
        </div>
      )}
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

export default KeySelectionCard;
