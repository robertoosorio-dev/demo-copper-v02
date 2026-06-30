import React, { useState, useMemo } from "react";
import type {
  PersonalizationStrategy,
  ClarificationQuestion,
  ClarificationOption,
} from "@copper/contracts";
import { useStore } from "../../store.js";
import { useAgentChat } from "../../hooks/useAgentChat.js";
import { IconSparkles, IconPencil, IconDotsVertical, IconCheck } from "@tabler/icons-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return `ps_${Math.random().toString(36).slice(2, 9)}`; }

// ── Analyzing overlay ─────────────────────────────────────────────────────────

function AnalyzingOverlay() {
  return (
    <div className="cs-analyzing">
      <div className="cs-analyzing-blob" />
      <span className="cs-analyzing-label">Analyzing</span>
    </div>
  );
}

// ── Clarification questions ───────────────────────────────────────────────────

interface ClarificationPanelProps {
  questions: ClarificationQuestion[];
  onConfirm: (answers: Record<string, string[]>) => void;
  onCancel: () => void;
}

function ClarificationPanel({ questions, onConfirm, onCancel }: ClarificationPanelProps) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  const toggle = (qid: string, oid: string, multiSelect: boolean) => {
    setSelections((prev) => {
      const cur = prev[qid] ?? [];
      if (multiSelect) {
        return { ...prev, [qid]: cur.includes(oid) ? cur.filter((x) => x !== oid) : [...cur, oid] };
      }
      return { ...prev, [qid]: [oid] };
    });
  };

  const allAnswered = questions.every((q) => (selections[q.id] ?? []).length > 0);

  return (
    <div className="cs-clarify">
      <div className="cs-clarify-title">A few questions to complete the strategy</div>
      {questions.map((q) => (
        <div key={q.id} className="cs-clarify-question">
          <div className="cs-clarify-q-text">{q.text}</div>
          <div className="cs-clarify-options">
            {q.options.map((opt: ClarificationOption) => {
              const selected = (selections[q.id] ?? []).includes(opt.id);
              return (
                <label
                  key={opt.id}
                  className={`cs-clarify-opt${selected ? " cs-clarify-opt--selected" : ""}`}
                >
                  <input
                    type={q.multiSelect ? "checkbox" : "radio"}
                    name={q.id}
                    checked={selected}
                    onChange={() => toggle(q.id, opt.id, q.multiSelect)}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <div className="cs-clarify-footer">
        <button className="cs-btn cs-btn--ghost" onClick={onCancel}>Cancel</button>
        <button className="cs-btn cs-btn--primary" disabled={!allAnswered} onClick={() => onConfirm(selections)}>
          Confirm
        </button>
      </div>
    </div>
  );
}

// ── Column mapping diagram ────────────────────────────────────────────────────

function ColumnMappingDiagram({ strategy }: { strategy: PersonalizationStrategy }) {
  // Collect all columns per table
  const tableColumns: Record<string, string[]> = {};
  for (const t of strategy.tables) {
    tableColumns[t.name] = [];
  }
  for (const m of strategy.columnMappings) {
    if (!tableColumns[m.fromTable]) tableColumns[m.fromTable] = [];
    if (!tableColumns[m.toTable])   tableColumns[m.toTable]   = [];
    if (!tableColumns[m.fromTable].includes(m.fromColumn)) tableColumns[m.fromTable].push(m.fromColumn);
    if (!tableColumns[m.toTable].includes(m.toColumn))     tableColumns[m.toTable].push(m.toColumn);
  }

  const COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6"];

  return (
    <div className="cs-mapping">
      <div className="cs-mapping-tables">
        {strategy.tables.map((tbl, ti) => (
          <div key={tbl.id} className="cs-mapping-table">
            <div className="cs-mapping-table-header">
              <span className="cs-mapping-table-icon">⊞</span>
              <a className="cs-mapping-table-name" href="#">{tbl.name}</a>
            </div>
            <div className="cs-mapping-cols">
              {(tableColumns[tbl.name] ?? []).map((col, ci) => {
                // find if this col is part of a mapping
                const mapping = strategy.columnMappings.find(
                  (m) => (m.fromTable === tbl.name && m.fromColumn === col) ||
                         (m.toTable === tbl.name && m.toColumn === col)
                );
                const colorIdx = mapping ? strategy.columnMappings.indexOf(mapping) % COLORS.length : -1;
                return (
                  <div key={col} className="cs-mapping-col">
                    <span className="cs-mapping-col-name">{col}</span>
                    {colorIdx >= 0 && (
                      <span className="cs-mapping-dot" style={{ background: COLORS[colorIdx] }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {strategy.columnMappings.length > 0 && (
        <div className="cs-mapping-legend">
          {strategy.columnMappings.map((m, i) => (
            <div key={i} className="cs-mapping-legend-row">
              <span className="cs-mapping-dot" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="cs-mapping-legend-text">
                <strong>{m.fromTable}</strong> · {m.fromColumn} → <strong>{m.toTable}</strong> · {m.toColumn}
                {m.relationship && <em> — {m.relationship}</em>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Strategy card (read-only confirmed state) ─────────────────────────────────

function StrategyCard({ strategy }: { strategy: PersonalizationStrategy }) {
  return (
    <div className="cs-strategy-card">
      <div className="cs-strategy-card-header">
        <div className="cs-strategy-card-title">{strategy.title}</div>
        <button className="cs-icon-btn"><IconDotsVertical size={14} /></button>
      </div>
      <div className="cs-strategy-card-desc">{strategy.description}</div>
      <div className="cs-strategy-card-chain">
        <span className="cs-chain-label">Data Tables link + Built-in Signal:</span>
        {strategy.tables.map((t, i) => (
          <React.Fragment key={t.id}>
            <a className="cs-chain-link" href="#">⊞ {t.name}</a>
            {i < strategy.tables.length - 1 && <span className="cs-chain-arrow">→</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ── Delivery type choice ──────────────────────────────────────────────────────

interface DeliveryTypeCardProps {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}

function DeliveryTypeCard({ selected, disabled, onSelect, title, description }: DeliveryTypeCardProps) {
  return (
    <div
      className={`cs-delivery-card${selected ? " cs-delivery-card--selected" : ""}${disabled ? " cs-delivery-card--disabled" : ""}`}
      onClick={disabled ? undefined : onSelect}
    >
      <div className="cs-delivery-title">{title}</div>
      <div className="cs-delivery-desc">{description}</div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function CampaignStrategyView() {
  const version     = useStore((s) => s.version);
  const isLoading   = useStore((s) => s.isLoading);
  const exchanges   = useStore((s) => s.version?.context.exchanges ?? []);
  const { submit }  = useAgentChat();

  const creativeModel   = version?.plans?.creative?.model ?? null;
  const deliveryType    = creativeModel?.deliveryType ?? null;
  const strategies      = creativeModel?.personalizationStrategies ?? [];

  // Pull pending clarification questions from the latest exchange
  const pendingQuestions = useMemo<ClarificationQuestion[]>(() => {
    const last = [...exchanges].reverse().find(
      (e) => e.role === "assistant" && (e as any).clarificationQuestions?.length
    );
    return (last as any)?.clarificationQuestions ?? [];
  }, [exchanges]);

  const [addingStrategy, setAddingStrategy] = useState(false);
  const [strategyDescription, setStrategyDescription] = useState("");

  // ── Delivery type selection ─────────────────────────────────────────────

  function handleDeliverySelect(type: "with-personalization" | "without-personalization") {
    if (isLoading) return;
    void submit(
      `I want to use "${type === "with-personalization" ? "With personalization" : "Without personalization"}" ` +
      `as the creative delivery type for this campaign. Please set the delivery type and analyse the brief and ` +
      `media plan to suggest the next steps.`
    );
  }

  // ── Analyze strategy ────────────────────────────────────────────────────

  function handleAnalyze() {
    const desc = strategyDescription.trim();
    const msg = desc
      ? `Analyze this personalization strategy and set up the data connections: ${desc}`
      : `Analyze the campaign brief and media plan to infer the personalization strategy and set up the data connections automatically.`;
    void submit(msg);
    setAddingStrategy(false);
    setStrategyDescription("");
  }

  // ── Clarification answers ───────────────────────────────────────────────

  function handleClarificationConfirm(answers: Record<string, string[]>) {
    // Serialize answers to natural language and send to agent
    const lines = Object.entries(answers).map(([qid, optIds]) => {
      const q = pendingQuestions.find((x) => x.id === qid);
      const labels = optIds.map((oid) => q?.options.find((o) => o.id === oid)?.label ?? oid);
      return `${q?.text ?? qid}: ${labels.join(", ")}`;
    });
    void submit(`Here are my answers:\n${lines.join("\n")}`);
  }

  // ── Ask AI ──────────────────────────────────────────────────────────────

  function handleAskAI(context: string) {
    void submit(
      `Please analyze the campaign brief and media plan and suggest the best ${context} for this campaign.`
    );
  }

  const withPersonalization = deliveryType === "with-personalization";
  const deliveryConfirmed   = deliveryType !== null;

  return (
    <div className="cs-root">
      {/* Creative delivery type */}
      <section className="cs-section">
        <div className="cs-section-head">
          <span className="cs-section-label">Creative delivery type<span className="cs-required">*</span></span>
        </div>

        <div className="cs-question-row">
          <span className="cs-question-text">Do you want to personalize your campaign?</span>
          <div className="cs-question-actions">
            {deliveryConfirmed && (
              <button className="cs-action-btn" onClick={() => handleDeliverySelect(deliveryType!)}>
                <IconPencil size={12} /> Edit
              </button>
            )}
            <button className="cs-action-btn cs-action-btn--ai" onClick={() => handleAskAI("delivery type")}>
              <IconSparkles size={12} /> Ask AI
            </button>
          </div>
        </div>

        {deliveryConfirmed ? (
          <div className="cs-delivery-confirmed">
            <div className="cs-delivery-confirmed-title">
              {withPersonalization ? "With personalization" : "Without personalization"}
            </div>
            <div className="cs-delivery-confirmed-desc">
              {withPersonalization
                ? "Master creative → multiple variants. Map or generate variants of the master creative and swaps elements (headline, product, image, CTA) per viewer using audience, weather, time, and location signals."
                : "You build distinct creatives. Synapse rotates them, runs an A/B/n test, and reports the winner — but the creatives stay exactly as you delivered them."}
            </div>
          </div>
        ) : (
          <div className="cs-delivery-choices">
            {isLoading && (
              <div className="cs-analyzing-inline" style={{ marginBottom: 8 }}>
                <div className="cs-loading-spinner" /> Setting delivery type…
              </div>
            )}
            <DeliveryTypeCard
              selected={false}
              disabled={isLoading}
              onSelect={() => handleDeliverySelect("with-personalization")}
              title="With personalization"
              description="Master creative → multiple variants. Map or generate variants of the master creative and swaps elements (headline, product, image, CTA) per viewer using audience, weather, time, and location signals."
            />
            <DeliveryTypeCard
              selected={false}
              disabled={isLoading}
              onSelect={() => handleDeliverySelect("without-personalization")}
              title="Without personalization"
              description="You build distinct creatives (say, three separate ads for spicy, sweet, and salty). Synapse rotates them, runs an A/B/n test, and reports the winner — but the creatives stay exactly as you delivered them."
            />
          </div>
        )}
      </section>

      {/* Personalization strategy — only shown when with-personalization */}
      {withPersonalization && (
        <section className="cs-section">
          <div className="cs-question-row">
            <span className="cs-question-text">What is your Personalization Strategy?</span>
            <div className="cs-question-actions">
              <button className="cs-action-btn cs-action-btn--ai" onClick={() => handleAskAI("personalization strategy")}>
                <IconSparkles size={12} /> Ask AI
              </button>
            </div>
          </div>

          {/* Confirmed strategies */}
          {strategies.map((s) => (
            <StrategyCard key={s.id} strategy={s} />
          ))}

          {/* Add strategy panel */}
          {!addingStrategy && !isLoading && (
            <button
              className="cs-add-strategy-btn"
              onClick={() => setAddingStrategy(true)}
            >
              Add Strategy
              <span className="cs-add-strategy-close" onClick={(e) => { e.stopPropagation(); }}>⊕</span>
            </button>
          )}

          {addingStrategy && !isLoading && pendingQuestions.length === 0 && (
            <div className="cs-strategy-builder">
              <textarea
                className="cs-strategy-textarea"
                placeholder="Describe your personalization strategy (optional — AI can infer from the brief and media plan)"
                value={strategyDescription}
                onChange={(e) => setStrategyDescription(e.target.value)}
                rows={3}
              />
              <div className="cs-strategy-footer">
                <button className="cs-btn cs-btn--primary cs-btn--ai" onClick={handleAnalyze}>
                  <IconSparkles size={13} /> Analyze with AI
                </button>
                <button className="cs-btn cs-btn--ghost" onClick={() => { setAddingStrategy(false); setStrategyDescription(""); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Analyzing state */}
          {isLoading && addingStrategy === false && strategies.length === 0 && (
            <AnalyzingOverlay />
          )}
          {isLoading && (
            <div className="cs-analyzing-inline">
              <div className="cs-loading-spinner" /> Analyzing…
            </div>
          )}

          {/* Clarification questions */}
          {!isLoading && pendingQuestions.length > 0 && (
            <ClarificationPanel
              questions={pendingQuestions}
              onConfirm={handleClarificationConfirm}
              onCancel={() => { /* questions remain until next exchange clears them */ }}
            />
          )}

          {/* Column mapping result — shown after strategies are set but before confirmed */}
          {/* (Agent emits patchCreative → strategies populate → user sees mapping → saves) */}
          {strategies.length > 0 && strategies.some((s) => !s.confirmedAt) && (
            strategies.filter((s) => !s.confirmedAt).map((s) => (
              <div key={s.id} className="cs-strategy-result">
                <div className="cs-strategy-result-fields">
                  <div className="cs-field-row">
                    <label className="cs-field-label">Title</label>
                    <div className="cs-field-value cs-field-value--editable">{s.title}</div>
                  </div>
                  <div className="cs-field-row">
                    <label className="cs-field-label">Description</label>
                    <div className="cs-field-value">{s.description}</div>
                  </div>
                  <div className="cs-chain-preview">
                    {s.tables.map((t, i) => (
                      <React.Fragment key={t.id}>
                        <a className="cs-chain-link" href="#">⊞ {t.name}</a>
                        {i < s.tables.length - 1 && <span className="cs-chain-arrow">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <ColumnMappingDiagram strategy={s} />
                <div className="cs-strategy-result-footer">
                  <button
                    className="cs-btn cs-btn--primary"
                    onClick={() => {
                      void submit(`Save the personalization strategy "${s.title}" — it looks correct.`);
                    }}
                  >
                    <IconCheck size={13} /> Save
                  </button>
                  <button className="cs-btn cs-btn--ghost" onClick={() => { setAddingStrategy(true); }}>
                    Cancel
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* Product display order — placeholder, not yet implemented */}
      <section className="cs-section cs-section--dimmed">
        <div className="cs-section-head">
          <span className="cs-section-label">Product display order<span className="cs-required">*</span></span>
        </div>
        <div className="cs-skeleton-rows">
          {[80, 100, 90, 70, 95, 85, 75, 60].map((w, i) => (
            <div key={i} className="cs-skeleton-row" style={{ width: `${w}%` }} />
          ))}
        </div>
      </section>
    </div>
  );
}
