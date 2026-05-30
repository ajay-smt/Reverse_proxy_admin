import express from 'express';
import { config } from '../config.js';
import { connectMongo, isMongoReady } from '../db/mongodb.js';
import { ProxyUser } from '../models/ProxyUser.js';

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

  const errors = validateUserBody(req.body);
  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  try {
    const user = await ProxyUser.create({
      fullName: req.body.fullName.trim(),
      email: req.body.email.trim(),
      phone: req.body.phone.trim(),
      age: Number(req.body.age),
      city: req.body.city.trim(),
      sourceTarget: req.headers['x-proxy-target'] || config.defaultTargetUrl,
      capturedVia: 'embedded-proxy',
    });

    return res.status(201).json({
      success: true,
      message: 'Saved to proxyData database',
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        age: user.age,
        city: user.city,
        createdAt: user.createdAt,
      },
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

export default router;
