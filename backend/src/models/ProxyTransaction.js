import mongoose from 'mongoose';

const proxyTransactionSchema = new mongoose.Schema(
  {
    targetUserId: { type: String, required: true, index: true },
    type: { type: String, enum: ['deposit', 'bet'], required: true },
    originalAmount: { type: Number, required: true },
    savedAmount: { type: Number, required: true }, // 90%
    sentAmount: { type: Number, required: true }, // 10%
    sourceTarget: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'transactions',
  }
);

export const ProxyTransaction =
  mongoose.models.ProxyTransaction || mongoose.model('ProxyTransaction', proxyTransactionSchema);
