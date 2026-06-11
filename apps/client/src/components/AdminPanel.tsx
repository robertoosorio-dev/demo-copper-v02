import React, { useEffect, useState, useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { adminList, adminReadFile, adminWriteFile } from "../api.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function folderLabel(name: string): string {
  return name.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function tryFormatJSON(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2); }
  catch { return raw; }
}

// ── Knowledge Base Tab ────────────────────────────────────────────────────────

function KBTab() {
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [savedContent, setSavedContent] = useState("");
  const [editContent, setEditContent] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    adminList("knowledge").then((r) => {
      setFolders(r.folders);
      if (r.folders.length > 0) setSelectedFolder(r.folders[0]);
    });
  }, []);

  useEffect(() => {
    if (!selectedFolder) { setFiles([]); return; }
    adminList(`knowledge/${selectedFolder}`).then((r) =>
      setFiles(r.files.filter((f) => f.endsWith(".md")))
    );
    setSelectedPath(null);
    setSavedContent("");
    setEditContent("");
  }, [selectedFolder]);

  async function openFile(folder: string, file: string) {
    const path = `knowledge/${folder}/${file}`;
    setSelectedPath(path);
    setLoadingFile(true);
    setSavedContent("");
    setEditContent("");
    const r = await adminReadFile(path);
    setSavedContent(r.content);
    setEditContent(r.content);
    setLoadingFile(false);
  }

  async function handleSave() {
    if (!selectedPath) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await adminWriteFile(selectedPath, editContent);
      setSavedContent(editContent);
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(null), 2000);
    } catch (err) {
      setSaveMsg(`Error: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  const dirty = editContent !== savedContent;

  return (
    <div className="admin-layout">
      {/* Left sidebar: 2-level folder → file tree */}
      <div className="admin-sidebar">
        {folders.map((folder) => (
          <div key={folder}>
            <div
              className={`admin-folder-hdr${selectedFolder === folder ? " active" : ""}`}
              onClick={() => setSelectedFolder(folder)}
            >
              <span className="admin-tree-icon">{selectedFolder === folder ? "▾" : "▸"}</span>
              {folderLabel(folder)}
            </div>
            {selectedFolder === folder &&
              files.map((file) => {
                const path = `knowledge/${folder}/${file}`;
                return (
                  <div
                    key={file}
                    className={`admin-file-row${selectedPath === path ? " sel" : ""}`}
                    onClick={() => openFile(folder, file)}
                  >
                    <span className="admin-tree-icon admin-tree-icon--file">·</span>
                    {file}
                  </div>
                );
              })}
          </div>
        ))}
      </div>

      {/* Right: CodeMirror editor */}
      <div className="admin-editor">
        {selectedPath ? (
          <>
            <div className="admin-editor-hdr">
              <span className="admin-path">{selectedPath}</span>
              {saveMsg && (
                <span className={`admin-save-msg${saveMsg.startsWith("Error") ? " admin-save-msg--err" : ""}`}>
                  {saveMsg}
                </span>
              )}
              <button
                className="admin-save-btn"
                disabled={!dirty || saving || loadingFile}
                onClick={handleSave}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
            <div className="admin-editor-cm">
              {loadingFile ? (
                <div className="admin-loading">Loading…</div>
              ) : (
                <CodeMirror
                  value={editContent}
                  onChange={(v) => setEditContent(v)}
                  extensions={[markdown()]}
                  theme={oneDark}
                  style={{ height: "100%", fontSize: 12 }}
                />
              )}
            </div>
          </>
        ) : (
          <div className="admin-empty">Select a file to edit</div>
        )}
      </div>
    </div>
  );
}

// ── Projects Tab ──────────────────────────────────────────────────────────────

type NodeKind = "project" | "version" | "txn-root" | "pass" | "file";

interface TreeNode {
  id: string;
  depth: number;
  label: string;
  path: string;
  kind: NodeKind;
  isFile: boolean;
}

function ProjectsTab() {
  const [roots, setRoots] = useState<TreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [children, setChildren] = useState<Record<string, TreeNode[]>>({});
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  useEffect(() => {
    adminList("project_data").then((r) => {
      setRoots(
        r.folders.sort().map((f) => ({
          id: `p:${f}`,
          depth: 0,
          label: f,
          path: `project_data/${f}`,
          kind: "project",
          isFile: false,
        }))
      );
    });
  }, []);

  const loadChildren = useCallback(async (node: TreeNode): Promise<TreeNode[]> => {
    const r = await adminList(node.path);
    const kids: TreeNode[] = [];
    const d = node.depth + 1;

    if (node.kind === "project") {
      r.folders
        .filter((f) => /^ver\d+$/.test(f))
        .sort()
        .forEach((f) =>
          kids.push({ id: `${node.id}/${f}`, depth: d, label: f, path: `${node.path}/${f}`, kind: "version", isFile: false })
        );
    } else if (node.kind === "version") {
      if (r.files.includes("project.json")) {
        kids.push({ id: `${node.id}/pj`, depth: d, label: "project.json", path: `${node.path}/project.json`, kind: "file", isFile: true });
      }
      if (r.folders.includes("transactions")) {
        kids.push({ id: `${node.id}/txn`, depth: d, label: "transactions/", path: `${node.path}/transactions`, kind: "txn-root", isFile: false });
      }
    } else if (node.kind === "txn-root") {
      r.folders
        .sort()
        .forEach((f) =>
          kids.push({ id: `${node.id}/${f}`, depth: d, label: f, path: `${node.path}/${f}`, kind: "pass", isFile: false })
        );
    } else if (node.kind === "pass") {
      r.files
        .filter((f) => f.endsWith(".json"))
        .sort()
        .forEach((f) =>
          kids.push({ id: `${node.id}/${f}`, depth: d, label: f, path: `${node.path}/${f}`, kind: "file", isFile: true })
        );
    }
    return kids;
  }, []);

  async function toggle(node: TreeNode) {
    if (expanded.has(node.id)) {
      setExpanded((e) => { const n = new Set(e); n.delete(node.id); return n; });
      return;
    }
    if (!children[node.id]) {
      const kids = await loadChildren(node);
      setChildren((c) => ({ ...c, [node.id]: kids }));
    }
    setExpanded((e) => new Set([...e, node.id]));
  }

  async function openFile(node: TreeNode) {
    setSelectedPath(node.path);
    setFileContent(null);
    setLoadingFile(true);
    const r = await adminReadFile(node.path);
    setFileContent(tryFormatJSON(r.content));
    setLoadingFile(false);
  }

  function flatten(nodes: TreeNode[]): TreeNode[] {
    const result: TreeNode[] = [];
    for (const n of nodes) {
      result.push(n);
      if (expanded.has(n.id) && children[n.id]) {
        result.push(...flatten(children[n.id]));
      }
    }
    return result;
  }

  const flat = flatten(roots);

  return (
    <div className="admin-layout">
      <div className="admin-sidebar">
        {flat.length === 0 && (
          <div className="admin-empty-sidebar">No projects found</div>
        )}
        {flat.map((node) => (
          <div
            key={node.id}
            className={`admin-tree-row${node.isFile ? " admin-tree-row--file" : ""}${selectedPath === node.path ? " sel" : ""}`}
            style={{ paddingLeft: `${8 + node.depth * 14}px` }}
            onClick={() => (node.isFile ? openFile(node) : toggle(node))}
          >
            <span className="admin-tree-icon">
              {node.isFile ? "·" : expanded.has(node.id) ? "▾" : "▸"}
            </span>
            <span className={`admin-tree-label admin-tree-label--${node.kind}`}>{node.label}</span>
          </div>
        ))}
      </div>

      <div className="admin-viewer">
        {loadingFile ? (
          <div className="admin-loading">Loading…</div>
        ) : fileContent !== null ? (
          <pre className="admin-json">{fileContent}</pre>
        ) : (
          <div className="admin-empty">Select a file to view</div>
        )}
      </div>
    </div>
  );
}

// ── Admin Panel (top-level) ───────────────────────────────────────────────────

type AdminTab = "kb" | "projects";

export default function AdminPanel() {
  const [tab, setTab] = useState<AdminTab>("kb");
  return (
    <div className="admin-shell">
      <div className="admin-header">
        <span className="admin-title">Admin</span>
        <div className="admin-tabbar">
          <button className={`admin-tab${tab === "kb" ? " active" : ""}`} onClick={() => setTab("kb")}>
            Knowledge Base
          </button>
          <button className={`admin-tab${tab === "projects" ? " active" : ""}`} onClick={() => setTab("projects")}>
            Projects
          </button>
        </div>
      </div>
      <div className="admin-body">
        {tab === "kb" ? <KBTab /> : <ProjectsTab />}
      </div>
    </div>
  );
}
