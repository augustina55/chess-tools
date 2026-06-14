import { useState } from 'react';

export default function ApiKeyModal({ onClose, onSaved }) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const trimmed = key.trim();
    if (!trimmed) {
      setError('Please enter your API key');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/config/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: trimmed })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save key');
      }

      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 px-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">OpenAI API Key</h2>
            <p className="text-sm text-slate-400 mt-1">
              Required to use GPT-4o Vision for chess position detection
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white text-2xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* How to get key */}
        <div className="bg-slate-800/70 rounded-xl p-4 space-y-2.5 border border-slate-700/50">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">How to get your OpenAI key</p>
          <ol className="text-sm text-slate-300 space-y-1.5 list-none">
            <li className="flex gap-2">
              <span className="text-green-500 font-bold flex-shrink-0">1.</span>
              Go to <span className="font-mono text-blue-400">platform.openai.com/api-keys</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-500 font-bold flex-shrink-0">2.</span>
              Log in or sign up
            </li>
            <li className="flex gap-2">
              <span className="text-green-500 font-bold flex-shrink-0">3.</span>
              Click <strong>Create new secret key</strong>
            </li>
            <li className="flex gap-2">
              <span className="text-green-500 font-bold flex-shrink-0">4.</span>
              Copy &amp; paste it below
            </li>
          </ol>
          <p className="text-xs text-slate-500 pt-0.5">
            Your key is saved to <code className="text-slate-400">.env</code> locally — never sent anywhere except OpenAI
          </p>
        </div>

        {/* Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">API Key</label>
          <input
            type="password"
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="sk-proj-…"
            autoFocus
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-green-500 transition-colors font-mono"
          />
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 hover:text-white transition-colors border border-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !key.trim()}
            className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {loading ? 'Saving…' : 'Save Key'}
          </button>
        </div>
      </div>
    </div>
  );
}
