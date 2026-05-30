import mongoose from 'mongoose';

const proxyUserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    age: { type: Number, required: true },
    city: { type: String, required: true, trim: true },
    sourceTarget: { type: String, default: '' },
    capturedVia: { type: String, default: 'embedded-proxy' },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

export const ProxyUser =
  mongoose.models.ProxyUser || mongoose.model('ProxyUser', proxyUserSchema);
