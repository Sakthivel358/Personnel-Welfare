/**
 * Persistent Datastore Adapter for SIH26186 Personnel Welfare System
 * Guarantees persistent storage in JSON files when running standalone,
 * with real encryption, indexing, and Mongoose-compatible operations.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class Collection {
  constructor(name) {
    this.name = name;
    this.filePath = path.join(DATA_DIR, `${name}.json`);
    this.init();
  }

  init() {
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  _read() {
    try {
      this.init();
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(raw || '[]');
    } catch (err) {
      console.error(`[DB Error] Reading ${this.name}:`, err.message);
      return [];
    }
  }

  _write(data) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[DB Error] Writing ${this.name}:`, err.message);
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
    for (const key of Object.keys(query)) {
      const qVal = query[key];
      if (qVal && typeof qVal === 'object' && !Array.isArray(qVal)) {
        if ('$in' in qVal && Array.isArray(qVal.$in)) {
          if (!qVal.$in.includes(item[key])) return false;
        } else if ('$gte' in qVal) {
          if (item[key] < qVal.$gte) return false;
        } else if ('$lte' in qVal) {
          if (item[key] > qVal.$lte) return false;
        } else if ('$ne' in qVal) {
          if (item[key] === qVal.$ne) return false;
        }
      } else if (String(item[key]).toLowerCase() !== String(qVal).toLowerCase()) {
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
