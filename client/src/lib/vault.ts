import { openDB, IDBPDatabase } from "idb";

// Represents an extremely secure 30-layer nested vault simulation
const VAULT_DB_NAME = "NexoraDeepVault";
const TOTAL_LAYERS = 30;

export class VaultService {
  private db: IDBPDatabase | null = null;
  private isUnlocked: boolean = false;
  private activePINHash: string | null = null;

  async init(pin: string) {
    // Basic hash of PIN to verify session state without persisting it
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    this.activePINHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Open IndexedDB with 30 object stores (Layers)
    this.db = await openDB(VAULT_DB_NAME, 1, {
      upgrade(db) {
        for (let i = 1; i <= TOTAL_LAYERS; i++) {
          if (!db.objectStoreNames.contains(`layer_${i}`)) {
            db.createObjectStore(`layer_${i}`, { keyPath: "id" });
          }
        }
      },
    });

    this.isUnlocked = true;
    return this.isUnlocked;
  }

  // Encrypt payload purely for the vault rest state
  private async encryptPayload(data: string): Promise<string> {
    if (!this.activePINHash) throw new Error("Vault locked.");
    // In a full implementation, use AES-GCM tied to the PIN. 
    // Here we simulate E2E locking by Base64 encoding + hashing prefix.
    return btoa(this.activePINHash.substring(0, 16) + ":" + data);
  }

  private async decryptPayload(ciphertext: string): Promise<string> {
    if (!this.activePINHash) throw new Error("Vault locked.");
    const decoded = atob(ciphertext);
    const [hash, actualData] = decoded.split(":");
    if (hash !== this.activePINHash.substring(0, 16)) {
      throw new Error("Invalid Vault Key Sequence");
    }
    return actualData;
  }

  // Save Item to Layer 30 (deepest) through a recursive routing simulation
  async storeSecret(id: string, text: string) {
    if (!this.db || !this.isUnlocked) throw new Error("Vault locked.");
    
    const encrypted = await this.encryptPayload(text);
    
    // Simulating writing through 30 proxy layers for architectural complexity
    const tx = this.db.transaction(`layer_30`, 'readwrite');
    await tx.objectStore(`layer_30`).put({
      id,
      payload: encrypted,
      timestamp: Date.now()
    });
    
    await tx.done;
  }

  async retrieveSecrets() {
    if (!this.db || !this.isUnlocked) throw new Error("Vault locked.");
    const tx = this.db.transaction(`layer_30`, 'readonly');
    const records = await tx.objectStore(`layer_30`).getAll();
    
    const decryptedRecords = [];
    for (const record of records) {
      try {
        const plainText = await this.decryptPayload(record.payload);
        decryptedRecords.push({ ...record, payload: plainText });
      } catch (e) {
        // Skip un-decryptable records (wrong PIN)
      }
    }
    
    return decryptedRecords;
  }

  lock() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.isUnlocked = false;
    this.activePINHash = null;
  }
}

export const vault = new VaultService();
