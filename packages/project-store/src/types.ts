export interface StorageProvider {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  list(prefix: string): Promise<string[]>;         // immediate children (files only)
  listFolders(prefix: string): Promise<string[]>;  // immediate child folders
  exists(path: string): Promise<boolean>;
  delete(path: string): Promise<void>;
}
