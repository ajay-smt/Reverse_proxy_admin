import mongoose from 'mongoose';
import { config } from '../config.js';

export async function connectMongo() {
  if (!config.mongodbUri) {
    console.warn('[mongodb] MONGODB_URI not set — proxyData capture disabled');
    return false;
  }

  if (mongoose.connection.readyState === 1) return true;

  try {
    await mongoose.connect(config.mongodbUri, {
      dbName: config.mongodbDbName,
    });
    console.log(`[mongodb] Connected to database "${config.mongodbDbName}"`);
    return true;
  } catch (err) {
    console.error('[mongodb] Connection failed:', err.message);
    return false;
  }
}

export function isMongoReady() {
  return mongoose.connection.readyState === 1;
}
