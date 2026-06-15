import React from 'react';

export type ImportSettingsCardProps = {
  tableName: string;
  brand?: string;
  refreshMode: 'auto' | 'manual';
  scheduleLabel?: string;
  sourceLabel?: string;
  onEdit?: () => void;
  onSave?: () => void;
};

export function ImportSettingsCard({ tableName, brand, refreshMode, scheduleLabel, sourceLabel, onEdit, onSave }: ImportSettingsCardProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Import settings</div>
      <h3 className="mt-1 text-lg font-semibold text-gray-950">{tableName}</h3>
      {brand && <div className="mt-1 text-sm text-gray-500">Brand: {brand}</div>}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Setting label="Refresh behavior" value={refreshMode === 'auto' ? 'Auto' : 'Manual'} />
        <Setting label="Schedule" value={scheduleLabel ?? (refreshMode === 'auto' ? 'Scheduled' : 'Not scheduled')} />
        {sourceLabel && <Setting label="Source" value={sourceLabel} />}
      </div>

      <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm leading-5 text-gray-600">
        {refreshMode === 'auto'
          ? 'Auto re-pulls the source and reapplies filters and mapping each time.'
          : 'Manual keeps the imported table frozen until the user syncs it again.'}
      </p>

      <div className="mt-5 flex gap-2">
        {onSave && <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white" onClick={onSave}>Save</button>}
        {onEdit && <button className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700" onClick={onEdit}>Edit</button>}
      </div>
    </section>
  );
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 font-medium text-gray-950">{value}</div>
    </div>
  );
}

export default ImportSettingsCard;
