import React from 'react';

export type FieldMappingRow = {
  id: string;
  fileColumnName: string;
  systemColumnName: string;
  category?: string;
  type?: string;
  sampleValue?: string;
  warning?: string;
};

export type FieldMappingCardProps = {
  rows: FieldMappingRow[];
  mappedCount: number;
  totalCount: number;
  typeWarnings?: number;
  onChangeMapping?: (rowId: string, nextSystemColumnName: string) => void;
};

export function FieldMappingCard({ rows, mappedCount, totalCount, typeWarnings = 0 }: FieldMappingCardProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Field mapping</div>
          <h3 className="mt-1 text-lg font-semibold text-gray-950">Columns mapped — {mappedCount} / {totalCount}</h3>
        </div>
        {typeWarnings > 0 && <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">{typeWarnings} type warnings</span>}
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">File column</th>
              <th className="px-3 py-2">System field</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Sample</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 font-medium text-gray-900">{row.fileColumnName}</td>
                <td className="px-3 py-2 text-gray-700">{row.systemColumnName}</td>
                <td className="px-3 py-2 text-gray-500">{row.category}</td>
                <td className={row.warning ? 'px-3 py-2 text-orange-700' : 'px-3 py-2 text-gray-500'}>{row.type}</td>
                <td className="max-w-[160px] truncate px-3 py-2 text-gray-500">{row.sampleValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default FieldMappingCard;
