import React from 'react';

export type SourceOption = {
  id: string;
  label: string;
  kind: 'live_feed' | 'snapshot';
};

export type SourceInputCardProps = {
  selectedSourceId?: string;
  options: SourceOption[];
  onSelect?: (sourceId: string) => void;
  onConnect?: () => void;
  authLabel?: string;
  fields?: Array<{ label: string; value?: string; placeholder?: string }>;
};

export function SourceInputCard({ selectedSourceId, options, onSelect, onConnect, authLabel, fields = [] }: SourceInputCardProps) {
  const liveFeeds = options.filter((option) => option.kind === 'live_feed');
  const snapshots = options.filter((option) => option.kind === 'snapshot');

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Select input</div>
      <h3 className="mt-1 text-lg font-semibold text-gray-950">Catalog source</h3>
      <p className="mt-2 text-sm leading-5 text-gray-600">Upload a file or connect a live feed. The agent will detect the schema and validate the data before it powers execution.</p>

      <SourceGroup title="Live feeds — re-syncs on a schedule" options={liveFeeds} selectedSourceId={selectedSourceId} onSelect={onSelect} />
      <SourceGroup title="Files — one-time snapshot" options={snapshots} selectedSourceId={selectedSourceId} onSelect={onSelect} />

      {fields.length > 0 && (
        <div className="mt-5 space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
          {authLabel && <div className="text-sm font-medium text-gray-800">Auth: {authLabel}</div>}
          {fields.map((field) => (
            <label key={field.label} className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{field.label}</span>
              <input className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" value={field.value ?? ''} placeholder={field.placeholder} readOnly />
            </label>
          ))}
          {onConnect && <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white" onClick={onConnect}>Connect</button>}
        </div>
      )}
    </section>
  );
}

function SourceGroup({ title, options, selectedSourceId, onSelect }: { title: string; options: SourceOption[]; selectedSourceId?: string; onSelect?: (sourceId: string) => void }) {
  if (options.length === 0) return null;
  return (
    <div className="mt-5">
      <div className="text-sm font-medium text-gray-700">{title}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button key={option.id} className={option.id === selectedSourceId ? 'rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700' : 'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700'} onClick={() => onSelect?.(option.id)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default SourceInputCard;
