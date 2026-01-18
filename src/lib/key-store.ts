/**
 * Simple in-memory key store for project derived keys.
 * This persists keys across route changes during a single session.
 */
class ProjectKeyStore {
  private keys: Map<string, CryptoKey> = new Map();

  setKey(projectId: string, key: CryptoKey) {
    this.keys.set(projectId, key);
  }

  getKey(projectId: string): CryptoKey | null {
    return this.keys.get(projectId) || null;
  }

  removeKey(projectId: string) {
    this.keys.delete(projectId);
  }

  clear() {
    this.keys.clear();
  }
}

export const keyStore = new ProjectKeyStore();
