import React from 'react';

export type TablePreviewCardProps = {
  tableName: string;
  rowsCount: number;
  columns: string[];
  rows: Array<Record<string, string | number | null | undefined>>;
  pageSize?: number;
  onSave?: () => void;
};

const formatNumber = (value: number) => new Intl.NumberFormat().format(value);

export function TablePreviewCard({ tableName, rowsCount, columns, rows, pageSize = 50, onSave }: TablePreviewCardProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Table preview</div>
          <h3 className="mt-1 text-lg font-semibold text-gray-950">{tableName}</h3>
          <div className="mt-1 text-sm text-gray-500">{formatNumber(rowsCount)} results · {pageSize} per page</div>
        </div>
        {onSave && <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white" onClick={onSave}>Save</button>}
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              {columns.map((column) => <th key={column} className="px-3 py-2">{column}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => <td key={column} className="max-w-[220px] truncate px-3 py-2 text-gray-700">{String(row[column] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default TablePreviewCard;
