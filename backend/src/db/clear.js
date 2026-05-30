import mongoose from 'mongoose';
import { connectMongo } from './mongodb.js';
import { ProxyUser } from '../models/ProxyUser.js';
import { ProxyTransaction } from '../models/ProxyTransaction.js';

async function clear() {
  try {
    const connected = await connectMongo();
    if (!connected) {
      console.error('Failed to connect to MongoDB');
      process.exit(1);
    }
    const resUsers = await ProxyUser.deleteMany({});
    const resTx = await ProxyTransaction.deleteMany({});
    console.log(`Successfully cleared ${resUsers.deletedCount} proxy users and ${resTx.deletedCount} transactions from local database.`);
  } catch (error) {
    console.error('Error clearing database:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

clear();
