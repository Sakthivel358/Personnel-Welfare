/**
 * Database connection & persistence engine for SIH26186 Personnel Welfare System
 */
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

let isMongoConnected = false;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  
  if (uri && uri.startsWith('mongodb')) {
    try {
      console.log(`[DB] Attempting connection to MongoDB (${uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')})...`);
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 4000,
      });
      isMongoConnected = true;
      console.log('[DB] Connected successfully to MongoDB instance.');
      return;
    } catch (err) {
      console.warn(`[DB Warning] Connection to MongoDB failed (${err.message}). Using local persistent disk database.`);
    }
  } else {
    console.log('[DB] No external MONGODB_URI specified. Operating with persistent local database engine.');
  }

  // Ensure local data directory exists
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

const getDBStatus = () => {
  if (isMongoConnected && mongoose.connection.readyState === 1) {
    return {
      status: 'Connected (MongoDB)',
      type: 'MongoDB',
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      isConnected: true
    };
  }
  return {
    status: 'Operational (Persistent Local Storage)',
    type: 'LocalDiskStore',
    host: 'Local Disk /backend/data',
    name: 'personnel_welfare_db',
    isConnected: true
  };
};

module.exports = { connectDB, getDBStatus, isMongoConnected: () => isMongoConnected };
