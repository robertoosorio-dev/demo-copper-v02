import { Storage } from "@google-cloud/storage";

const BUCKET_NAME = process.env.GCS_BUCKET ?? "demo_activation";

export class GCSStorageProvider {
  private _bucket: ReturnType<Storage["bucket"]>;

  constructor() {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error("[storage/gcs] GOOGLE_SERVICE_ACCOUNT_JSON env var is not set");
    let credentials: Record<string, unknown>;
    try {
      credentials = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error("[storage/gcs] GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
    }
    const client = new Storage({ credentials });
    this._bucket = client.bucket(BUCKET_NAME);
  }

  async validate(): Promise<void> {
    try {
      await this._bucket.getFiles({ maxResults: 1 });
    } catch (err) {
      throw new Error(`[storage/gcs] Bucket "${BUCKET_NAME}" not accessible: ${(err as Error).message}`);
    }
    console.log(`[storage/gcs] ✅ Connected to bucket "${BUCKET_NAME}"`);
  }

  async read(p: string): Promise<string> {
    console.log(`[gcs] read  ${p}`);
    const [contents] = await this._bucket.file(p).download();
    return contents.toString("utf8");
  }

  async write(p: string, content: string): Promise<void> {
    console.log(`[gcs] write ${p} (${content.length} bytes)`);
    await this._bucket.file(p).save(content, { contentType: "text/plain; charset=utf-8" });
  }

  async list(prefix: string): Promise<string[]> {
    const queryPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
    const [files] = await this._bucket.getFiles({ prefix: queryPrefix });
    const names = files
      .map((f) => f.name.slice(queryPrefix.length))
      .filter((name) => name.length > 0 && !name.includes("/"));
    console.log(`[gcs] list  ${prefix} → [${names.join(", ")}]`);
    return names;
  }

  async listFolders(prefix: string): Promise<string[]> {
    const queryPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
    const [, , apiResponse] = await this._bucket.getFiles({
      prefix: queryPrefix,
      delimiter: "/",
      autoPaginate: false,
    });
    const prefixes = (apiResponse as { prefixes?: string[] }).prefixes ?? [];
    return prefixes.map((p) => p.slice(queryPrefix.length).replace(/\/$/, ""));
  }

  async exists(p: string): Promise<boolean> {
    const [ex] = await this._bucket.file(p).exists();
    return ex;
  }

  async delete(p: string): Promise<void> {
    await this._bucket.file(p).delete();
  }
}
