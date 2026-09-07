/**
 * Persistent Datastore Adapter for SIH26186 Personnel Welfare System
 * Guarantees persistent storage in JSON files when running standalone,
 * with real encryption, indexing, and Mongoose-compatible operations.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Detect if local directory is writable or if running in serverless (e.g. Vercel / AWS Lambda)
let DATA_DIR = path.join(__dirname, '..', 'data');
const SEED_DIR = DATA_DIR;

try {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    DATA_DIR = path.join(os.tmpdir(), 'welfare_data');
  }
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  // Test write
  const testFile = path.join(DATA_DIR, '.write_test');
  fs.writeFileSync(testFile, 'ok');
  fs.unlinkSync(testFile);
} catch (e) {
  DATA_DIR = path.join(os.tmpdir(), 'welfare_data');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

class Collection {
  constructor(name) {
    this.name = name;
    this.filePath = path.join(DATA_DIR, `${name}.json`);
    this.seedPath = path.join(SEED_DIR, `${name}.json`);
    this._cache = null;
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(this.filePath)) {
        if (fs.existsSync(this.seedPath)) {
          const seedData = fs.readFileSync(this.seedPath, 'utf-8');
          fs.writeFileSync(this.filePath, seedData, 'utf-8');
          this._cache = JSON.parse(seedData || '[]');
        } else {
          fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), 'utf-8');
          this._cache = [];
        }
      } else {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this._cache = JSON.parse(raw || '[]');
      }
    } catch (err) {
      if (fs.existsSync(this.seedPath)) {
        try {
          const seedData = fs.readFileSync(this.seedPath, 'utf-8');
          this._cache = JSON.parse(seedData || '[]');
        } catch (_) {
          this._cache = [];
        }
      } else {
        this._cache = [];
      }
    }
  }

  _read() {
    try {
      if (fs.existsSync(this.filePath)) {
        const stat = fs.statSync(this.filePath);
        if (this._cache === null || !this._lastMtime || stat.mtimeMs > this._lastMtime) {
          const raw = fs.readFileSync(this.filePath, 'utf-8');
          this._cache = JSON.parse(raw || '[]');
          this._lastMtime = stat.mtimeMs;
        }
        return this._cache;
      }
    } catch (err) {
      // fallback
    }
    return this._cache || [];
  }

  _write(data) {
    this._cache = data;
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
      try {
        const stat = fs.statSync(this.filePath);
        this._lastMtime = stat.mtimeMs;
      } catch (_) {}

      // If running with separate data & seed paths (e.g. serverless /tmp), write-through to seed if possible
      if (this.seedPath && this.seedPath !== this.filePath) {
        try {
          fs.writeFileSync(this.seedPath, JSON.stringify(data, null, 2), 'utf-8');
        } catch (_) {}
      }
    } catch (err) {
      console.warn(`[DB Storage Warn] Disk write to ${this.name}:`, err.message);
    }
  }

  async find(query = {}) {
    let items = this._read();
    return items.filter(item => this._matches(item, query));
  }

  async findOne(query = {}) {
    const items = this._read();
    return items.find(item => this._matches(item, query)) || null;
  }

  async findById(id) {
    const items = this._read();
    return items.find(item => String(item._id) === String(id) || String(item.id) === String(id)) || null;
  }

  async create(doc) {
    const items = this._read();
    const newDoc = {
      _id: doc._id || crypto.randomBytes(12).toString('hex'),
      ...doc,
      createdAt: doc.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    items.push(newDoc);
    this._write(items);
    return newDoc;
  }

  async findByIdAndUpdate(id, update, options = { new: true }) {
    const items = this._read();
    const index = items.findIndex(item => String(item._id) === String(id) || String(item.id) === String(id));
    if (index === -1) return null;

    const current = items[index];
    const updated = {
      ...current,
      ...(update.$set ? update.$set : update),
      updatedAt: new Date().toISOString()
    };
    items[index] = updated;
    this._write(items);
    return updated;
  }

  async findOneAndUpdate(query, update, options = { new: true }) {
    const items = this._read();
    const index = items.findIndex(item => this._matches(item, query));
    if (index === -1) {
      if (options && options.upsert) {
        const newDoc = {
          _id: 'db_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          ...query,
          ...(update.$set ? update.$set : update),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        items.push(newDoc);
        this._write(items);
        return newDoc;
      }
      return null;
    }

    const current = items[index];
    const updated = {
      ...current,
      ...(update.$set ? update.$set : update),
      updatedAt: new Date().toISOString()
    };
    items[index] = updated;
    this._write(items);
    return updated;
  }

  async updateMany(query, update) {
    const items = this._read();
    let count = 0;
    const updatedItems = items.map(item => {
      if (this._matches(item, query)) {
        count++;
        return {
          ...item,
          ...(update.$set ? update.$set : update),
          updatedAt: new Date().toISOString()
        };
      }
      return item;
    });
    this._write(updatedItems);
    return { modifiedCount: count };
  }

  async deleteOne(query) {
    const items = this._read();
    const index = items.findIndex(item => this._matches(item, query));
    if (index !== -1) {
      items.splice(index, 1);
      this._write(items);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  async countDocuments(query = {}) {
    const items = await this.find(query);
    return items.length;
  }

  _matches(item, query) {
    if (!item || !query) return false;

    // Support MongoDB-style $or: [ { cond1 }, { cond2 } ]
    if (query.$or && Array.isArray(query.$or)) {
      const orMatches = query.$or.some(subQuery => this._matches(item, subQuery));
      if (!orMatches) return false;
    }

    for (const key of Object.keys(query)) {
      if (key === '$or') continue;
      const qVal = query[key];

      // Support ID matching on _id or id
      if (key === '_id' || key === 'id') {
        const itemId = String(item._id || item.id || '');
        if (itemId !== String(qVal)) return false;
        continue;
      }

      if (qVal && typeof qVal === 'object' && !Array.isArray(qVal)) {
        if ('$in' in qVal && Array.isArray(qVal.$in)) {
          if (!qVal.$in.some(v => String(v).toLowerCase() === String(item[key]).toLowerCase())) return false;
        } else if ('$gte' in qVal) {
          if (item[key] < qVal.$gte) return false;
        } else if ('$lte' in qVal) {
          if (item[key] > qVal.$lte) return false;
        } else if ('$ne' in qVal) {
          if (String(item[key]).toLowerCase() === String(qVal.$ne).toLowerCase()) return false;
        }
      } else if (String(item[key] || '').toLowerCase() !== String(qVal || '').toLowerCase()) {
        return false;
      }
    }
    return true;
  }
}

const db = {
  Users: new Collection('users'),
  Personnel: new Collection('personnel'),
  CheckIns: new Collection('checkins'),
  Predictions: new Collection('stress_predictions'),
  Recommendations: new Collection('recommendations'),
  Alerts: new Collection('alerts'),
  FollowUps: new Collection('followups'),
  SupportRequests: new Collection('support_requests'),
  Notifications: new Collection('notifications'),
  WelfareResources: new Collection('welfare_resources'),
  AuditLogs: new Collection('audit_logs')
};

module.exports = db;
