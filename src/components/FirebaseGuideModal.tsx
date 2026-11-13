import React, { useState } from 'react';
import { X, Copy, Check, Database } from 'lucide-react';
import { RTDB_RULES_SNIPPET, isFirebaseConfigured } from '../firebaseConfig';

interface FirebaseGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export const FirebaseGuideModal: React.FC<FirebaseGuideModalProps> = ({ open, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const configured = isFirebaseConfigured();

  const handleCopyRules = () => {
    navigator.clipboard?.writeText(RTDB_RULES_SNIPPET).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-[#151C2C] border border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 max-h-[88vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-amber-400" />
            <h2 className="font-display text-lg font-bold text-white">
              Firebase Realtime Database Setup
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-300 mb-4 leading-relaxed">
          {configured
            ? 'Firebase Realtime Database is configured and active for live room state and WebRTC signaling.'
            : 'Placeholder config detected in src/firebaseConfig.ts — the app is currently using the built-in live WebSocket server so you can play right away. To switch to your own Firebase RTDB:'}
        </p>

        <ol className="space-y-2.5 text-sm text-slate-300 list-decimal list-inside mb-5">
          <li>Create a project in the Firebase Console and enable Realtime Database.</li>
          <li>Register a Web App in Project Settings and copy your config object (including <code className="text-amber-300 font-mono text-xs">databaseURL</code>).</li>
          <li>Paste those values into <code className="text-amber-300 font-mono text-xs">FIREBASE_CONFIG</code> at the top of <code className="text-amber-300 font-mono text-xs">src/firebaseConfig.ts</code> (or set <code className="text-amber-300 font-mono text-xs">VITE_FIREBASE_*</code> env vars).</li>
          <li>Publish these Realtime Database rules for room & WebRTC signaling sync:</li>
        </ol>

        <div className="relative bg-[#0B0F17] border border-slate-800 rounded-2xl p-4 mb-4">
          <button
            type="button"
            onClick={handleCopyRules}
            className="absolute top-3 right-3 min-h-[36px] px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <pre className="text-xs font-mono text-emerald-300 overflow-x-auto pr-16">
            {RTDB_RULES_SNIPPET}
          </pre>
        </div>
      </div>
    </div>
  );
};
