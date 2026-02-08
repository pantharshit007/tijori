/**
 * Simple in-memory key store for project derived keys.
 * This persists keys across route changes during a single session.
 */
class ProjectKeyStore {
  private keys: Map<string, { key: CryptoKey; expiresAt: number }> = new Map();
  private readonly ttlMs = 60 * 60 * 1000; // 1 hour
  private listeners: Set<() => void> = new Set();

  setKey(projectId: string, key: CryptoKey) {
    this.keys.set(projectId, { key, expiresAt: Date.now() + this.ttlMs });
    this.notify();
  }

  getKey(projectId: string): CryptoKey | null {
    const entry = this.keys.get(projectId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.keys.delete(projectId);
      return null;
    }
    return entry.key;
  }

  removeKey(projectId: string) {
    this.keys.delete(projectId);
    this.notify();
  }

  clear() {
    this.keys.clear();
    this.notify();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot() {
    return this.keys.size;
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __tijoriKeyStore: ProjectKeyStore | undefined;
}

export const keyStore = globalThis.__tijoriKeyStore ?? new ProjectKeyStore();
globalThis.__tijoriKeyStore = keyStore;
