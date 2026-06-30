import React, { useState, useCallback } from "react";
import {
  IconArrowLeft,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconPlus,
  IconFile,
  IconBrandInstagram,
  IconBrandMeta,
  IconExternalLink,
} from "@tabler/icons-react";
import type { Brand, BrandField, BrandSeverity, BrandSource } from "@copper/contracts";
import { saveBrand as apiSaveBrand } from "../../api.js";
import type { ExtractedField } from "../../api.js";
import { useStore } from "../../store.js";
import BrandAgentPanel from "./BrandAgentPanel.js";
import ComplianceView, { countUnconfirmedRules, confirmAllRules } from "./ComplianceView.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyField(): BrandField {
  return { value: "", confidence: null, sourceLabel: null, sourcePage: null, confirmed: false };
}

const SEVERITY_LABELS: Record<BrandSeverity, string> = {
  suggestion: "Suggestion",
  preference: "Preference",
  required:   "Required",
};

const SEVERITY_DESCRIPTIONS: Record<BrandSeverity, string> = {
  suggestion: "AI may deviate — guidelines inform but do not constrain generation.",
  preference: "AI follows guidelines unless context strongly warrants deviation.",
  required:   "AI must never violate these rules. Non-compliance blocks output.",
};

// ── Confidence badge ──────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: BrandField["confidence"] }) {
  if (!confidence) return null;
  const colors: Record<string, string> = {
    high:   "#16a34a",
    medium: "#d97706",
    low:    "#dc2626",
  };
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: colors[confidence],
        background: colors[confidence] + "1a",
        border: `1px solid ${colors[confidence]}44`,
        borderRadius: 4,
        padding: "1px 6px",
        textTransform: "capitalize",
      }}
    >
      {confidence}
    </span>
  );
}

// ── Source pill ───────────────────────────────────────────────────────────────

function SourcePill({ label, page }: { label: string | null; page: string | null }) {
  if (!label) return null;
  return (
    <span
      style={{
        fontSize: 11,
        color: "#9747FF",
        background: "#9747FF1a",
        border: "1px solid #9747FF44",
        borderRadius: 4,
        padding: "1px 8px",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <IconFile size={10} />
      {label}{page ? ` · ${page}` : ""}
    </span>
  );
}

// ── Single field row ──────────────────────────────────────────────────────────

function FieldRow({
  label,
  description,
  field,
  onChange,
  multiline,
}: {
  label: string;
  description?: string;
  field: BrandField;
  onChange: (patch: Partial<BrandField>) => void;
  multiline?: boolean;
}) {
  const showWarning = field.confidence === "low" && !field.confirmed;
  const showUndo    = field.confirmed && field.confidence !== null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        gap: 16,
        padding: "14px 0",
        borderBottom: "1px solid #f1f5f9",
        alignItems: "start",
      }}
    >
      {/* Left: label + description */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{label}</div>
        {description && (
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, lineHeight: 1.4 }}>
            {description}
          </div>
        )}
      </div>

      {/* Right: value + meta */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Source + confidence row */}
        {(field.sourceLabel || field.confidence) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SourcePill label={field.sourceLabel} page={field.sourcePage} />
            <ConfidenceBadge confidence={field.confidence} />
          </div>
        )}

        {/* Value input */}
        {multiline ? (
          <textarea
            value={field.value}
            onChange={(e) => onChange({ value: e.target.value, confirmed: false })}
            rows={3}
            style={{
              width: "100%",
              fontSize: 13,
              border: showWarning ? "1.5px solid #dc262666" : "1px solid #e2e8f0",
              borderRadius: 6,
              padding: "8px 10px",
              resize: "vertical",
              fontFamily: "inherit",
              color: "#1e293b",
              background: "#fff",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        ) : (
          <input
            type="text"
            value={field.value}
            onChange={(e) => onChange({ value: e.target.value, confirmed: false })}
            style={{
              width: "100%",
              fontSize: 13,
              border: showWarning ? "1.5px solid #dc262666" : "1px solid #e2e8f0",
              borderRadius: 6,
              padding: "8px 10px",
              fontFamily: "inherit",
              color: "#1e293b",
              background: "#fff",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        )}

        {/* Warning + confirm/undo row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {showWarning && (
            <span style={{ fontSize: 11, color: "#dc2626", display: "flex", alignItems: "center", gap: 4 }}>
              <IconAlertTriangle size={12} />
              Low confidence — please review
            </span>
          )}
          <div style={{ flex: 1 }} />
          {!field.confirmed && field.value && (
            <button
              onClick={() => onChange({ confirmed: true })}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#2563EB",
                background: "transparent",
                border: "1px solid #2563EB",
                borderRadius: 4,
                padding: "2px 10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <IconCheck size={11} /> Confirm
            </button>
          )}
          {showUndo && (
            <button
              onClick={() => onChange({ confirmed: false })}
              style={{
                fontSize: 11,
                color: "#64748b",
                background: "transparent",
                border: "1px solid #e2e8f0",
                borderRadius: 4,
                padding: "2px 10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <IconX size={11} /> Undo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Section wrapper with severity dropdown ────────────────────────────────────

function SectionCard({
  title,
  severity,
  onSeverityChange,
  children,
}: {
  title: string;
  severity: BrandSeverity;
  onSeverityChange: (s: BrandSeverity) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: "20px 24px",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: 0 }}>{title}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>AI severity:</span>
          <select
            value={severity}
            onChange={(e) => onSeverityChange(e.target.value as BrandSeverity)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              padding: "3px 8px",
              color: severity === "required" ? "#dc2626" : severity === "preference" ? "#d97706" : "#2563EB",
              background: "#f8fafc",
              cursor: "pointer",
            }}
          >
            {(["suggestion", "preference", "required"] as BrandSeverity[]).map((s) => (
              <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Left nav ──────────────────────────────────────────────────────────────────

type NavSection =
  | "basic"
  | "promise"
  | "tone"
  | "text"
  | "visual"
  | "image"
  | "messaging"
  | "compliance"
  | "connectors";

const NAV_SECTIONS: { id: NavSection; label: string; indent?: boolean }[] = [
  { id: "basic",      label: "Basic Details" },
  { id: "promise",    label: "Promise & Story",        indent: true },
  { id: "tone",       label: "Tone & Voice",           indent: true },
  { id: "text",       label: "Text Guidelines",        indent: true },
  { id: "visual",     label: "Visual Identity",        indent: true },
  { id: "image",      label: "Image Guidelines",       indent: true },
  { id: "messaging",  label: "Messaging Guidelines",   indent: true },
  { id: "compliance", label: "Compliance Rules" },
  { id: "connectors", label: "Connectors" },
];

// Fields that are user-visible per section (AI-only fields excluded)
const SECTION_FIELDS: Record<NavSection, (b: Brand) => BrandField[]> = {
  basic:      (b) => [b.basicDetails.name, b.basicDetails.industry, b.basicDetails.regions, b.basicDetails.languages],
  promise:    (b) => [b.guidelines.promiseAndStory.brandPromise, b.guidelines.promiseAndStory.brandStory],
  tone:       (b) => [b.guidelines.toneAndVoice.traits, b.guidelines.toneAndVoice.personalityAttributes, b.guidelines.toneAndVoice.isIsNotFraming],
  text:       (b) => [b.guidelines.textGuidelines.dosAndDonts, b.guidelines.textGuidelines.requiredPhrases, b.guidelines.textGuidelines.restrictedLanguage],
  visual:     (b) => [b.guidelines.visualIdentity.logoVariants, b.guidelines.visualIdentity.colorPalette, b.guidelines.visualIdentity.typographyHierarchy],
  image:      (b) => [b.guidelines.imageGuidelines.dosAndDonts, b.guidelines.imageGuidelines.compositionConstraints, b.guidelines.imageGuidelines.styleConstraints],
  messaging:  (b) => [b.guidelines.messagingGuidelines.guidelines, b.guidelines.messagingGuidelines.tagline, b.guidelines.messagingGuidelines.taglineUsageRules, b.guidelines.messagingGuidelines.cobrandingRules],
  compliance: (b) => [b.complianceRules.requiredDisclaimers, b.complianceRules.restrictedTerms, b.complianceRules.legalNotes, b.complianceRules.regulatedCategories],
  connectors: () => [], // no BrandFields
};

interface SectionStats {
  filled: number;
  total: number;
  needsAttention: boolean; // has low-confidence unconfirmed field
}

function getSectionStats(brand: Brand, section: NavSection): SectionStats | null {
  const fields = SECTION_FIELDS[section]?.(brand);
  if (!fields || fields.length === 0) return null;
  const filled = fields.filter((f) => !!f.value).length;
  const needsAttention = fields.some((f) => f.confidence === "low" && !f.confirmed);
  return { filled, total: fields.length, needsAttention };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BrandSubFlow({
  brand: initialBrand,
  onBack,
  onSave,
}: {
  brand: Brand;
  onBack: () => void;
  onSave?: (brand: Brand) => void;
}) {
  const [brand, setBrand] = useState<Brand>(initialBrand);
  const [activeSection, setActiveSection] = useState<NavSection>("basic");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [showRuleConfirmDialog, setShowRuleConfirmDialog] = useState(false);
  const setActiveBrand = useStore((s) => s.setActiveBrand);

  const patchField = useCallback(
    (path: string[], patch: Partial<BrandField>) => {
      setBrand((prev) => {
        const next = JSON.parse(JSON.stringify(prev)) as Brand;
        let node: Record<string, unknown> = next as unknown as Record<string, unknown>;
        for (let i = 0; i < path.length - 1; i++) {
          node = node[path[i]] as Record<string, unknown>;
        }
        const last = path[path.length - 1];
        node[last] = { ...(node[last] as BrandField), ...patch };
        return next;
      });
    },
    [],
  );

  const patchSeverity = useCallback(
    (key: keyof Brand["aiSeverity"], value: BrandSeverity) => {
      setBrand((prev) => ({
        ...prev,
        aiSeverity: { ...prev.aiSeverity, [key]: value },
      }));
    },
    [],
  );

  // Apply fields extracted by the agent — merge into current brand state
  // Field keys use dot-notation matching the Brand shape, e.g. "guidelines.toneAndVoice.traits"
  const applyExtractedFields = useCallback((fields: Record<string, ExtractedField>) => {
    setBrand((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as Brand;
      for (const [dotPath, extracted] of Object.entries(fields)) {
        const parts = dotPath.split(".");
        let node: Record<string, unknown> = next as unknown as Record<string, unknown>;
        for (let i = 0; i < parts.length - 1; i++) {
          node = node[parts[i]] as Record<string, unknown>;
          if (!node) break;
        }
        if (!node) continue;
        const last = parts[parts.length - 1];
        const existing = node[last] as BrandField | undefined;
        // Only overwrite if we got a real value and current field is empty or lower confidence
        const confRank = { high: 3, medium: 2, low: 1, null: 0 };
        const newRank  = confRank[extracted.confidence] ?? 0;
        const oldRank  = confRank[(existing?.confidence as string) ?? "null"] ?? 0;
        if (!existing?.value || newRank >= oldRank) {
          node[last] = {
            value:       extracted.value,
            confidence:  extracted.confidence,
            sourceLabel: extracted.sourceLabel,
            sourcePage:  extracted.sourcePage,
            confirmed:   false,
          };
        }
      }
      return next;
    });
  }, []);

  const addSource = useCallback((source: BrandSource) => {
    setBrand((prev) => {
      // Deduplicate by name
      if (prev.sources.some((s) => s.name === source.name)) return prev;
      return { ...prev, sources: [...prev.sources, source] };
    });
  }, []);

  async function handleSave(forceConfirmRules = false) {
    const unconfirmed = countUnconfirmedRules(brand.ruleSets ?? []);
    if (unconfirmed > 0 && !forceConfirmRules) {
      setShowRuleConfirmDialog(true);
      return;
    }
    setSaving(true);
    try {
      const nameFromForm = brand.basicDetails.name.value?.trim();
      const brandToSave = nameFromForm ? { ...brand, name: nameFromForm } : brand;
      // Auto-confirm all remaining AI rules if user chose "Save anyway"
      if (forceConfirmRules && unconfirmed > 0) {
        brandToSave.ruleSets = confirmAllRules(brandToSave.ruleSets ?? []);
      }
      const saved = await apiSaveBrand(brand.id, brandToSave);
      setBrand(saved);
      setActiveBrand(saved);
      onSave?.(saved);
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch (e) {
      setSaveMsg("Error saving");
    } finally {
      setSaving(false);
    }
  }

  const isReady =
    !!brand.basicDetails.name.value &&
    !!brand.basicDetails.regions.value &&
    brand.sources.length > 0 &&
    !Object.values(brand.basicDetails).some(
      (f) => (f as BrandField).confidence === "low" && !(f as BrandField).confirmed,
    );

  // ── Render content by section ─────────────────────────────────────────────

  function renderSection() {
    switch (activeSection) {
      case "basic":
        return (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "20px 24px",
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: "0 0 16px" }}>
              Basic Details
            </h3>
            <FieldRow
              label="Brand Name"
              field={brand.basicDetails.name}
              onChange={(p) => patchField(["basicDetails", "name"], p)}
            />
            <FieldRow
              label="Industry"
              description="Primary industry vertical"
              field={brand.basicDetails.industry}
              onChange={(p) => patchField(["basicDetails", "industry"], p)}
            />
            <FieldRow
              label="Regions"
              description="Markets where this brand operates"
              field={brand.basicDetails.regions}
              onChange={(p) => patchField(["basicDetails", "regions"], p)}
            />
            <FieldRow
              label="Languages"
              description="Primary languages for content"
              field={brand.basicDetails.languages}
              onChange={(p) => patchField(["basicDetails", "languages"], p)}
            />
          </div>
        );

      case "promise":
        return (
          <SectionCard
            title="Promise & Story"
            severity={brand.aiSeverity.promiseAndStory}
            onSeverityChange={(s) => patchSeverity("promiseAndStory", s)}
          >
            <FieldRow
              label="Brand Promise"
              description="Core commitment to customers"
              field={brand.guidelines.promiseAndStory.brandPromise}
              onChange={(p) => patchField(["guidelines", "promiseAndStory", "brandPromise"], p)}
              multiline
            />
            <FieldRow
              label="Brand Story"
              description="Origin, mission, and narrative arc"
              field={brand.guidelines.promiseAndStory.brandStory}
              onChange={(p) => patchField(["guidelines", "promiseAndStory", "brandStory"], p)}
              multiline
            />
          </SectionCard>
        );

      case "tone":
        return (
          <SectionCard
            title="Tone & Voice"
            severity={brand.aiSeverity.toneAndVoice}
            onSeverityChange={(s) => patchSeverity("toneAndVoice", s)}
          >
            <FieldRow
              label="Traits"
              description="3-5 adjectives that define the brand voice"
              field={brand.guidelines.toneAndVoice.traits}
              onChange={(p) => patchField(["guidelines", "toneAndVoice", "traits"], p)}
            />
            <FieldRow
              label="Personality Attributes"
              description="Deeper personality descriptors"
              field={brand.guidelines.toneAndVoice.personalityAttributes}
              onChange={(p) => patchField(["guidelines", "toneAndVoice", "personalityAttributes"], p)}
              multiline
            />
            <FieldRow
              label="Is / Is Not Framing"
              description="Explicit contrast — what the brand is and is not"
              field={brand.guidelines.toneAndVoice.isIsNotFraming}
              onChange={(p) => patchField(["guidelines", "toneAndVoice", "isIsNotFraming"], p)}
              multiline
            />
          </SectionCard>
        );

      case "text":
        return (
          <SectionCard
            title="Text Guidelines"
            severity={brand.aiSeverity.textGuidelines}
            onSeverityChange={(s) => patchSeverity("textGuidelines", s)}
          >
            <FieldRow
              label="Do's & Don'ts"
              description="Copy rules for writers and AI"
              field={brand.guidelines.textGuidelines.dosAndDonts}
              onChange={(p) => patchField(["guidelines", "textGuidelines", "dosAndDonts"], p)}
              multiline
            />
            <FieldRow
              label="Required Phrases"
              description="Phrases that must appear verbatim"
              field={brand.guidelines.textGuidelines.requiredPhrases}
              onChange={(p) => patchField(["guidelines", "textGuidelines", "requiredPhrases"], p)}
            />
            <FieldRow
              label="Restricted Language"
              description="Words or phrases to avoid"
              field={brand.guidelines.textGuidelines.restrictedLanguage}
              onChange={(p) => patchField(["guidelines", "textGuidelines", "restrictedLanguage"], p)}
            />
          </SectionCard>
        );

      case "visual":
        return (
          <SectionCard
            title="Visual Identity"
            severity={brand.aiSeverity.visualIdentity}
            onSeverityChange={(s) => patchSeverity("visualIdentity", s)}
          >
            <FieldRow
              label="Logo Variants"
              description="Primary, secondary, and lockup variants"
              field={brand.guidelines.visualIdentity.logoVariants}
              onChange={(p) => patchField(["guidelines", "visualIdentity", "logoVariants"], p)}
              multiline
            />
            <FieldRow
              label="Color Palette"
              description="Primary, secondary, and accent hex codes"
              field={brand.guidelines.visualIdentity.colorPalette}
              onChange={(p) => patchField(["guidelines", "visualIdentity", "colorPalette"], p)}
            />
            <FieldRow
              label="Typography Hierarchy"
              description="Heading, body, and display typefaces"
              field={brand.guidelines.visualIdentity.typographyHierarchy}
              onChange={(p) => patchField(["guidelines", "visualIdentity", "typographyHierarchy"], p)}
            />
          </SectionCard>
        );

      case "image":
        return (
          <SectionCard
            title="Image Guidelines"
            severity={brand.aiSeverity.imageGuidelines}
            onSeverityChange={(s) => patchSeverity("imageGuidelines", s)}
          >
            <FieldRow
              label="Do's & Don'ts"
              description="Image usage rules"
              field={brand.guidelines.imageGuidelines.dosAndDonts}
              onChange={(p) => patchField(["guidelines", "imageGuidelines", "dosAndDonts"], p)}
              multiline
            />
            <FieldRow
              label="Composition Constraints"
              description="Framing, crop, and layout rules"
              field={brand.guidelines.imageGuidelines.compositionConstraints}
              onChange={(p) => patchField(["guidelines", "imageGuidelines", "compositionConstraints"], p)}
              multiline
            />
            <FieldRow
              label="Style Constraints"
              description="Color treatment, filters, and mood"
              field={brand.guidelines.imageGuidelines.styleConstraints}
              onChange={(p) => patchField(["guidelines", "imageGuidelines", "styleConstraints"], p)}
              multiline
            />
          </SectionCard>
        );

      case "messaging":
        return (
          <SectionCard
            title="Messaging Guidelines"
            severity={brand.aiSeverity.messagingGuidelines}
            onSeverityChange={(s) => patchSeverity("messagingGuidelines", s)}
          >
            <FieldRow
              label="Guidelines"
              description="Overall messaging framework"
              field={brand.guidelines.messagingGuidelines.guidelines}
              onChange={(p) => patchField(["guidelines", "messagingGuidelines", "guidelines"], p)}
              multiline
            />
            <FieldRow
              label="Tagline"
              description="Primary brand tagline"
              field={brand.guidelines.messagingGuidelines.tagline}
              onChange={(p) => patchField(["guidelines", "messagingGuidelines", "tagline"], p)}
            />
            <FieldRow
              label="Tagline Usage Rules"
              description="When and how to use the tagline"
              field={brand.guidelines.messagingGuidelines.taglineUsageRules}
              onChange={(p) => patchField(["guidelines", "messagingGuidelines", "taglineUsageRules"], p)}
              multiline
            />
            <FieldRow
              label="Co-branding Rules"
              description="Partner and co-brand usage rules"
              field={brand.guidelines.messagingGuidelines.cobrandingRules}
              onChange={(p) => patchField(["guidelines", "messagingGuidelines", "cobrandingRules"], p)}
              multiline
            />
          </SectionCard>
        );

      case "compliance":
        return (
          <ComplianceView
            brandId={brand.id}
            ruleSets={brand.ruleSets ?? []}
            onChange={(rs) => setBrand((prev) => ({ ...prev, ruleSets: rs }))}
          />
        );

      case "connectors":
        return (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "20px 24px",
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: "0 0 16px" }}>
              Connectors
            </h3>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 10 }}>
                Source Links
              </div>
              {brand.connectors.sourceLinks.map((url, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                    fontSize: 13,
                    color: "#2563EB",
                  }}
                >
                  <IconExternalLink size={13} />
                  {url}
                </div>
              ))}
              <button
                onClick={() => {
                  const url = prompt("Enter URL:");
                  if (url) {
                    setBrand((prev) => ({
                      ...prev,
                      connectors: {
                        ...prev.connectors,
                        sourceLinks: [...prev.connectors.sourceLinks, url],
                      },
                    }));
                  }
                }}
                style={{
                  fontSize: 12,
                  color: "#2563EB",
                  background: "transparent",
                  border: "1px dashed #2563EB",
                  borderRadius: 6,
                  padding: "6px 14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 8,
                }}
              >
                <IconPlus size={12} /> Add link
              </button>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 10 }}>
                Connected Accounts
              </div>
              {brand.connectors.connectedAccounts.length === 0 && (
                <div style={{ fontSize: 13, color: "#94a3b8" }}>
                  No connected accounts yet.
                </div>
              )}
              {brand.connectors.connectedAccounts.map((acc, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    background: "#f8fafc",
                    borderRadius: 6,
                    marginBottom: 6,
                    fontSize: 13,
                  }}
                >
                  {acc.platform === "meta" ? (
                    <IconBrandMeta size={16} />
                  ) : acc.platform === "instagram" ? (
                    <IconBrandInstagram size={16} />
                  ) : null}
                  <span style={{ fontWeight: 600 }}>{acc.accountName}</span>
                  <span style={{ color: "#94a3b8" }}>·</span>
                  <span style={{ color: "#64748b" }}>{acc.purpose}</span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 11,
                      fontWeight: 600,
                      color: acc.status === "connected" ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {acc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  const unconfirmedCount = countUnconfirmedRules(brand.ruleSets ?? []);

  return (
    <div style={{ display: "flex", height: "100%", flexDirection: "column", background: "#f8fafc" }}>
      {/* Unconfirmed rules save dialog */}
      {showRuleConfirmDialog && (
        <div className="cr-overlay" style={{ zIndex: 2000 }}>
          <div className="cr-intent-dialog">
            <div className="cr-intent-title">Unreviewed compliance rules</div>
            <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.6 }}>
              <strong>{unconfirmedCount} rule{unconfirmedCount !== 1 ? "s" : ""}</strong> extracted by AI {unconfirmedCount !== 1 ? "have" : "has"} not been approved yet.
              Saving now will mark all of them as confirmed. You can still edit rules after saving.
            </p>
            <div className="cr-intent-footer">
              <button className="cr-btn cr-btn--ghost" onClick={() => setShowRuleConfirmDialog(false)}>
                Review first
              </button>
              <button className="cr-btn cr-btn--primary" onClick={() => { setShowRuleConfirmDialog(false); void handleSave(true); }}>
                Save anyway
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 20px",
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "#64748b",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            padding: "4px 8px",
            borderRadius: 6,
          }}
        >
          <IconArrowLeft size={16} /> Brands
        </button>
        <div
          style={{
            width: 1,
            height: 20,
            background: "#e2e8f0",
          }}
        />
        <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{brand.basicDetails.name.value || brand.name}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 4,
            background: isReady ? "#dcfce7" : "#f1f5f9",
            color: isReady ? "#16a34a" : "#64748b",
            border: `1px solid ${isReady ? "#86efac" : "#e2e8f0"}`,
          }}
        >
          {isReady ? "Ready" : "Draft"}
        </span>
        <div style={{ flex: 1 }} />
        {saveMsg && (
          <span style={{ fontSize: 12, color: saveMsg === "Saved" ? "#16a34a" : "#dc2626" }}>
            {saveMsg}
          </span>
        )}
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          style={{
            fontSize: 13,
            fontWeight: 600,
            background: "#2563EB",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "7px 18px",
            cursor: "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Body: nav + content + agent panel */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left nav */}
        <div
          style={{
            width: 220,
            background: "#fff",
            borderRight: "1px solid #e2e8f0",
            padding: "16px 0",
            flexShrink: 0,
            overflowY: "auto",
          }}
        >
          {/* Sources bar */}
          <div style={{ padding: "0 16px 12px", marginBottom: 8, borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Sources analyzed
            </div>
            {brand.sources.length === 0 ? (
              <div style={{ fontSize: 12, color: "#cbd5e1" }}>None added</div>
            ) : (
              brand.sources.map((src) => (
                <div
                  key={src.id}
                  style={{
                    fontSize: 12,
                    color: "#475569",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <IconFile size={11} /> {src.name}
                </div>
              ))
            )}
          </div>

          {/* Nav items */}
          {NAV_SECTIONS.map(({ id, label, indent }) => {
            const active = activeSection === id;
            const stats  = getSectionStats(brand, id);
            const hasData = stats !== null && stats.filled > 0;
            const warn    = stats?.needsAttention ?? false;
            return (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  textAlign: "left",
                  padding: `7px 12px 7px ${indent ? 28 : 16}px`,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? "#2563EB" : warn ? "#b45309" : "#475569",
                  background: active ? "#eff6ff" : "transparent",
                  border: "none",
                  borderLeft: active ? "3px solid #2563EB" : warn ? "3px solid #f59e0b" : "3px solid transparent",
                  cursor: "pointer",
                  gap: 6,
                }}
              >
                <span style={{ flex: 1 }}>{label}</span>
                {warn && (
                  <IconAlertTriangle size={12} color="#f59e0b" />
                )}
                {stats !== null && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: hasData
                        ? stats.filled === stats.total ? "#16a34a" : "#64748b"
                        : "#cbd5e1",
                      background: hasData ? (stats.filled === stats.total ? "#dcfce7" : "#f1f5f9") : "transparent",
                      borderRadius: 3,
                      padding: "1px 5px",
                      flexShrink: 0,
                    }}
                  >
                    {stats.filled}/{stats.total}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Center content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 24,
          }}
        >
          {renderSection()}
        </div>

        {/* Right: Agent panel */}
        <BrandAgentPanel
          brandId={brand.id}
          onFieldsExtracted={applyExtractedFields}
          onSourceAdded={addSource}
        />
      </div>
    </div>
  );
}
