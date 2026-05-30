import axios from 'axios';

const API_BASE = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL || 'http://localhost:5000')
  : window.location.origin;

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  withCredentials: true,
});

export function buildProxyUrl(targetUrl) {
  const base = API_BASE.replace(/\/$/, '');
  return `${base}/proxy?url=${encodeURIComponent(targetUrl)}`;
}

export async function checkProxyHealth() {
  const { data } = await api.get('/health');
  return data;
}

export { API_BASE };
