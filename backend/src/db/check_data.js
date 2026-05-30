import mongoose from 'mongoose';
import { connectMongo } from './mongodb.js';
import { ProxyUser } from '../models/ProxyUser.js';
import { ProxyTransaction } from '../models/ProxyTransaction.js';

async function check() {
  try {
    const connected = await connectMongo();
    if (!connected) {
      console.error('Failed to connect to MongoDB');
      process.exit(1);
    }
    
    const users = await ProxyUser.find().lean();
    console.log('--- CAPTURED USERS ---');
    console.log(JSON.stringify(users, null, 2));

    const transactions = await ProxyTransaction.find().lean();
    console.log('\n--- INTERCEPTED TRANSACTIONS ---');
    console.log(JSON.stringify(transactions, null, 2));

  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

check();
