/**
 * WelfareAI Client Offline Storage Vault & Synchronization Manager
 * Securely buffers authorized Check-In and Wearable Telemetry when offline,
 * verifies record integrity, and guarantees deduplicated synchronization when online.
 */

class OfflineVaultManager {
  constructor() {
    this.dbName = 'WelfareAI_OfflineVault';
    this.dbVersion = 1;
    this.db = null;
    this.isSupported = typeof window !== 'undefined' && 'indexedDB' in window;
    this.initPromise = this.initDB();
    this.setupNetworkListeners();
  }

  async initDB() {
    if (!this.isSupported) {
      console.warn('[OfflineVault] IndexedDB not available, using secured localStorage fallback.');
      return null;
    }

    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(this.dbName, this.dbVersion);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('checkin_vault')) {
            db.createObjectStore('checkin_vault', { keyPath: 'idempotencyKey' });
          }
          if (!db.objectStoreNames.contains('wearable_vault')) {
            db.createObjectStore('wearable_vault', { keyPath: 'idempotencyKey' });
          }
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          resolve(this.db);
        };

        request.onerror = (err) => {
          console.warn('[OfflineVault] IndexedDB open error, using localStorage fallback:', err);
          resolve(null);
        };
      } catch (e) {
        console.warn('[OfflineVault] IndexedDB exception, using localStorage fallback:', e);
        resolve(null);
      }
    });
  }

  /**
   * Generates a cryptographic or high-entropy transaction idempotency key
   */
  generateIdempotencyKey(prefix = 'offline') {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    const rand = Math.random().toString(36).substring(2, 10);
    return `${prefix}-${Date.now()}-${rand}`;
  }

  /**
   * Compute a secure integrity hash (SHA-256) of data payload to prevent tampering in local buffer
   */
  async computeIntegrityHash(payload) {
    const text = JSON.stringify(payload);
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
      try {
        const msgUint8 = new TextEncoder().encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        // fallback
      }
    }
    // Lightweight DJB2-based hash fallback if Web Crypto is restricted
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) + hash) + text.charCodeAt(i);
      hash = hash & hash;
    }
    return 'djb2-' + Math.abs(hash).toString(16);
  }

  // --- Check-in Vault Operations ---

  async saveCheckIn(payload) {
    await this.initPromise;
    const idempotencyKey = payload.idempotencyKey || this.generateIdempotencyKey('chk-offline');
    const enrichedPayload = {
      ...payload,
      idempotencyKey,
      isOfflineSubmission: true,
      bufferedAt: new Date().toISOString()
    };

    const integrityHash = await this.computeIntegrityHash(enrichedPayload);
    const vaultItem = {
      idempotencyKey,
      bufferedAt: enrichedPayload.bufferedAt,
      syncStatus: 'PENDING_SYNC',
      integrityHash,
      payload: enrichedPayload
    };

    if (this.db) {
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction('checkin_vault', 'readwrite');
        const store = tx.objectStore('checkin_vault');
        const req = store.put(vaultItem);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } else {
      const items = this._getLocalStorage('checkin_vault');
      items[idempotencyKey] = vaultItem;
      this._setLocalStorage('checkin_vault', items);
    }

    this.notifyVaultUpdated();
    return vaultItem;
  }

  async getPendingCheckIns() {
    await this.initPromise;
    let list = [];
    if (this.db) {
      list = await new Promise((resolve) => {
        const tx = this.db.transaction('checkin_vault', 'readonly');
        const store = tx.objectStore('checkin_vault');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } else {
      const map = this._getLocalStorage('checkin_vault');
      list = Object.values(map);
    }
    return list.filter(item => item.syncStatus === 'PENDING_SYNC');
  }

  async removeCheckIn(idempotencyKey) {
    await this.initPromise;
    if (this.db) {
      await new Promise((resolve) => {
        const tx = this.db.transaction('checkin_vault', 'readwrite');
        const store = tx.objectStore('checkin_vault');
        const req = store.delete(idempotencyKey);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } else {
      const items = this._getLocalStorage('checkin_vault');
      delete items[idempotencyKey];
      this._setLocalStorage('checkin_vault', items);
    }
    this.notifyVaultUpdated();
  }

  // --- Wearable Telemetry Vault Operations ---

  async saveWearableTelemetry(telemetryPacket) {
    await this.initPromise;
    const idempotencyKey = telemetryPacket.idempotencyKey || this.generateIdempotencyKey('wb-offline');
    const enrichedPacket = {
      ...telemetryPacket,
      idempotencyKey,
      bufferedAt: new Date().toISOString()
    };

    const integrityHash = await this.computeIntegrityHash(enrichedPacket);
    const vaultItem = {
      idempotencyKey,
      bufferedAt: enrichedPacket.bufferedAt,
      syncStatus: 'PENDING_SYNC',
      integrityHash,
      packet: enrichedPacket
    };

    if (this.db) {
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction('wearable_vault', 'readwrite');
        const store = tx.objectStore('wearable_vault');
        const req = store.put(vaultItem);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } else {
      const items = this._getLocalStorage('wearable_vault');
      items[idempotencyKey] = vaultItem;
      this._setLocalStorage('wearable_vault', items);
    }

    this.notifyVaultUpdated();
    return vaultItem;
  }

  async getPendingWearableTelemetry() {
    await this.initPromise;
    let list = [];
    if (this.db) {
      list = await new Promise((resolve) => {
        const tx = this.db.transaction('wearable_vault', 'readonly');
        const store = tx.objectStore('wearable_vault');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } else {
      const map = this._getLocalStorage('wearable_vault');
      list = Object.values(map);
    }
    return list.filter(item => item.syncStatus === 'PENDING_SYNC');
  }

  async removeWearableTelemetry(idempotencyKey) {
    await this.initPromise;
    if (this.db) {
      await new Promise((resolve) => {
        const tx = this.db.transaction('wearable_vault', 'readwrite');
        const store = tx.objectStore('wearable_vault');
        const req = store.delete(idempotencyKey);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } else {
      const items = this._getLocalStorage('wearable_vault');
      delete items[idempotencyKey];
      this._setLocalStorage('wearable_vault', items);
    }
    this.notifyVaultUpdated();
  }

  // --- Synchronization Orchestrator ---

  async getPendingCounts() {
    const checkins = await this.getPendingCheckIns();
    const wearable = await this.getPendingWearableTelemetry();
    return {
      checkins: checkins.length,
      wearable: wearable.length,
      total: checkins.length + wearable.length
    };
  }

  async syncAllPending(apiClient) {
    if (!apiClient) {
      if (typeof api !== 'undefined') apiClient = api;
      else return { success: false, message: 'API client not available' };
    }

    const results = {
      syncedCheckins: 0,
      duplicateCheckins: 0,
      syncedWearable: 0,
      duplicateWearable: 0,
      errors: []
    };

    try {
      // 1. Synchronize Pending Check-ins
      const pendingCheckIns = await this.getPendingCheckIns();
      if (pendingCheckIns.length > 0) {
        const itemsToSync = [];
        for (const item of pendingCheckIns) {
          // Verify integrity checksum before sending
          const calculatedHash = await this.computeIntegrityHash(item.payload);
          if (calculatedHash === item.integrityHash) {
            itemsToSync.push(item.payload);
          } else {
            console.error(`[OfflineVault] Tamper detected on check-in ${item.idempotencyKey}! Hash mismatch.`);
            results.errors.push(`Check-in ${item.idempotencyKey} failed integrity verification.`);
          }
        }

        if (itemsToSync.length > 0) {
          try {
            const syncRes = await apiClient.syncCheckInsBatch(itemsToSync);
            if (syncRes && syncRes.success) {
              results.syncedCheckins = syncRes.syncedCount || 0;
              results.duplicateCheckins = syncRes.duplicateCount || 0;
              
              // Purge confirmed items from vault
              for (const item of pendingCheckIns) {
                await this.removeCheckIn(item.idempotencyKey);
              }
            }
          } catch (syncErr) {
            results.errors.push(`Check-in sync error: ${syncErr.message}`);
          }
        }
      }

      // 2. Synchronize Pending Wearable Telemetry
      const pendingWearable = await this.getPendingWearableTelemetry();
      if (pendingWearable.length > 0) {
        const packetsToSync = [];
        for (const item of pendingWearable) {
          const calculatedHash = await this.computeIntegrityHash(item.packet);
          if (calculatedHash === item.integrityHash) {
            packetsToSync.push(item.packet);
          } else {
            console.error(`[OfflineVault] Tamper detected on wearable telemetry ${item.idempotencyKey}!`);
            results.errors.push(`Wearable ${item.idempotencyKey} failed integrity verification.`);
          }
        }

        if (packetsToSync.length > 0) {
          try {
            const wbRes = await apiClient.syncWearableBatch(packetsToSync);
            if (wbRes && wbRes.success) {
              results.syncedWearable = wbRes.syncedCount || 0;
              results.duplicateWearable = wbRes.duplicateCount || 0;

              for (const item of pendingWearable) {
                await this.removeWearableTelemetry(item.idempotencyKey);
              }
            }
          } catch (wbErr) {
            results.errors.push(`Wearable sync error: ${wbErr.message}`);
          }
        }
      }

      this.notifyVaultUpdated();

      const totalSynced = results.syncedCheckins + results.syncedWearable;
      const totalDuplicates = results.duplicateCheckins + results.duplicateWearable;

      if ((totalSynced > 0 || totalDuplicates > 0) && typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast(
          `Vault Synced: ${totalSynced} record(s) uploaded, ${totalDuplicates} duplicate(s) safely prevented.`,
          'success',
          4000
        );
      }

      return { success: true, ...results };
    } catch (err) {
      console.error('[OfflineVault] Batch sync exception:', err);
      return { success: false, error: err.message, ...results };
    }
  }

  // --- Network Event Listeners & UI Helpers ---

  setupNetworkListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', async () => {
      console.log('[OfflineVault] Internet connection restored. Triggering automatic vault sync...');
      if (typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast('Internet connection restored. Synchronizing offline vault...', 'info', 2500);
      }
      await this.syncAllPending();
    });

    window.addEventListener('offline', () => {
      console.log('[OfflineVault] System switched to Offline Mode.');
      if (typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast('Offline Mode Active: Submissions will be stored in secure local vault.', 'warning', 3500);
      }
      this.notifyVaultUpdated();
    });
  }

  notifyVaultUpdated() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('welfareai-vault-updated'));
      this.updateOfflineBannerUI();
    }
  }

  async updateOfflineBannerUI() {
    if (typeof document === 'undefined') return;
    const banner = document.getElementById('offline-vault-banner');
    if (!banner) return;

    const counts = await this.getPendingCounts();
    const isOnline = navigator.onLine;

    if (counts.total > 0 || !isOnline) {
      banner.style.display = 'block';
      const textEl = document.getElementById('offline-vault-text');
      const syncBtn = document.getElementById('btn-vault-manual-sync');
      
      if (textEl) {
        if (!isOnline) {
          textEl.innerHTML = `<strong>Offline Mode Active:</strong> ${counts.total} record(s) securely buffered locally. Data will automatically synchronize when connection returns.`;
        } else {
          textEl.innerHTML = `<strong>Vault Pending:</strong> ${counts.total} offline record(s) waiting to sync. Connection active.`;
        }
      }

      if (syncBtn) {
        syncBtn.style.display = isOnline && counts.total > 0 ? 'inline-flex' : 'none';
      }
    } else {
      banner.style.display = 'none';
    }
  }

  _getLocalStorage(storeKey) {
    try {
      const raw = localStorage.getItem(`welfare_vault_${storeKey}`);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  _setLocalStorage(storeKey, obj) {
    try {
      localStorage.setItem(`welfare_vault_${storeKey}`, JSON.stringify(obj));
    } catch (e) {}
  }
}

// Global Singleton Instance
const OfflineVault = new OfflineVaultManager();

if (typeof window !== 'undefined') {
  window.OfflineVault = OfflineVault;
  document.addEventListener('DOMContentLoaded', () => {
    OfflineVault.updateOfflineBannerUI();
  });
}
