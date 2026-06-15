import React from 'react';

export type CustomFilterCardProps = {
  columns: string[];
  operators?: string[];
  selectedColumn?: string;
  selectedOperator?: string;
  value?: string;
  onApply?: () => void;
  onCancel?: () => void;
};

export function CustomFilterCard({ columns, operators = ['=', '!=', 'contains', '>', '<'], selectedColumn, selectedOperator, value, onApply, onCancel }: CustomFilterCardProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Custom filter</div>
      <h3 className="mt-1 text-lg font-semibold text-gray-950">Add custom filter</h3>
      <p className="mt-2 text-sm text-gray-600">Create a rule on any column with a column, operator, and value.</p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <ReadOnlySelect label="Column" value={selectedColumn ?? columns[0] ?? 'Select'} />
        <ReadOnlySelect label="Operator" value={selectedOperator ?? operators[0] ?? 'Select'} />
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Value</span>
          <input className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" value={value ?? ''} readOnly placeholder="Value" />
        </label>
      </div>

      <div className="mt-5 flex gap-2">
        {onApply && <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white" onClick={onApply}>Apply</button>}
        {onCancel && <button className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700" onClick={onCancel}>Cancel</button>}
      </div>
    </section>
  );
}

function ReadOnlySelect({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      <div className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900">{value}</div>
    </label>
  );
}

export default CustomFilterCard;
