import React from 'react';

export type ValidationFinding = {
  id: string;
  title: string;
  column?: string;
  rowsAffected: number;
  severity?: 'info' | 'warning' | 'error';
  status?: 'open' | 'ignored' | 'excluded';
};

export type ValidationFindingsCardProps = {
  findings: ValidationFinding[];
  onExclude?: (id: string) => void;
  onIgnore?: (id: string) => void;
  onUndo?: (id: string) => void;
  onApplyAll?: (action: 'exclude' | 'ignore') => void;
};

const formatNumber = (value: number) => new Intl.NumberFormat().format(value);

export function ValidationFindingsCard({ findings, onExclude, onIgnore, onUndo, onApplyAll }: ValidationFindingsCardProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Validation findings</div>
          <h3 className="mt-1 text-lg font-semibold text-gray-950">Issues list</h3>
        </div>
        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">{findings.length} issues</span>
      </div>

      {(onApplyAll && findings.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-3 text-sm">
          <span className="text-gray-600">Apply to all issues:</span>
          <button className="font-medium text-blue-700" onClick={() => onApplyAll('exclude')}>Exclude from import</button>
          <button className="font-medium text-blue-700" onClick={() => onApplyAll('ignore')}>Ignore</button>
        </div>
      )}

      <div className="mt-4 divide-y divide-gray-100">
        {findings.map((finding) => (
          <div key={finding.id} className="flex items-start justify-between gap-4 py-3">
            <div>
              <div className="font-medium text-gray-950">{finding.title}</div>
              <div className="mt-1 text-sm text-gray-500">
                {finding.column ? `Column: ${finding.column} · ` : ''}{formatNumber(finding.rowsAffected)} rows affected
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {finding.status && finding.status !== 'open' ? (
                onUndo && <button className="text-sm font-medium text-blue-700" onClick={() => onUndo(finding.id)}>Undo</button>
              ) : (
                <>
                  {onExclude && <button className="text-sm font-medium text-blue-700" onClick={() => onExclude(finding.id)}>Exclude</button>}
                  {onIgnore && <button className="text-sm font-medium text-gray-700" onClick={() => onIgnore(finding.id)}>Ignore</button>}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ValidationFindingsCard;
