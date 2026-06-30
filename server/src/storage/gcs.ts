import { Storage } from "@google-cloud/storage";

export class GCSStorageProvider {
  private _bucket: ReturnType<Storage["bucket"]>;
  private _bucketName: string;

  constructor() {
    // Read env vars inside the constructor so dotenv has already run by the time
    // this is instantiated (module-level consts would be captured before dotenv).
    this._bucketName = process.env.GCS_BUCKET ?? "demo_activation";
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error("[storage/gcs] GOOGLE_SERVICE_ACCOUNT_JSON env var is not set");
    let credentials: Record<string, unknown>;
    try {
      credentials = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error("[storage/gcs] GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
    }
    const client = new Storage({ credentials });
    this._bucket = client.bucket(this._bucketName);
  }

  async validate(): Promise<void> {
    try {
      await this._bucket.getFiles({ maxResults: 1 });
    } catch (err) {
      throw new Error(`[storage/gcs] Bucket "${this._bucketName}" not accessible: ${(err as Error).message}`);
    }
    console.log(`[storage/gcs] ✅ Connected to bucket "${this._bucketName}"`);
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
    const queryPrefix = (prefix === "" || prefix.endsWith("/")) ? prefix : `${prefix}/`;
    const [, , apiResponse] = await this._bucket.getFiles({
      prefix: queryPrefix,
      delimiter: "/",
      autoPaginate: false,
    });
    const prefixes = (apiResponse as { prefixes?: string[] }).prefixes ?? [];
    return prefixes.map((p) => p.slice(queryPrefix.length).replace(/\/$/, ""));
  }

  async readBinary(p: string): Promise<Buffer> {
    console.log(`[gcs] readBinary  ${p}`);
    const [contents] = await this._bucket.file(p).download();
    return contents;
  }

  async writeBinary(p: string, data: Buffer, contentType: string): Promise<void> {
    console.log(`[gcs] writeBinary ${p} (${data.length} bytes)`);
    await this._bucket.file(p).save(data, { contentType });
  }

  async exists(p: string): Promise<boolean> {
    const [ex] = await this._bucket.file(p).exists();
    return ex;
  }

  async delete(p: string): Promise<void> {
    await this._bucket.file(p).delete();
  }

  async deletePrefix(prefix: string): Promise<void> {
    const queryPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
    const [files] = await this._bucket.getFiles({ prefix: queryPrefix });
    await Promise.all(files.map((f) => f.delete()));
  }
}
