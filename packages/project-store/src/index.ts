// @copper/project-store
// GCS-backed versioned state storage.
// Layout: {project-id}/ver{NN}/project.json
//         {project-id}/ver{NN}/transactions/{pass-id}/rlog_{seq}.json

export { ProjectStoreGCS } from "./gcsStore.js";
export { computeDiff }      from "./diff.js";
export type { StorageProvider } from "./types.js";
