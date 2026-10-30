'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { CheckCircle2, AlertTriangle, Cloud, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function RedirectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      setLoading(false);
      setErrorMessage(`Google authentication was rejected or failed: ${error}`);
      return;
    }

    if (!code) {
      setLoading(false);
      setErrorMessage('Missing authorization code in redirect parameters.');
      return;
    }

    const exchangeCode = async () => {
      try {
        const redirectUri = `${window.location.origin}/redirect`;
        const res = await api.connectGoogleDriveCode(code, redirectUri);
        setSuccess(true);
        setUserEmail(res.userEmail || 'Google Drive User');
        setLoading(false);

        // Notify opener window if opened in a popup
        if (window.opener) {
          try {
            window.opener.postMessage('gdrive-connected', '*');
          } catch (e) {
            console.warn('Failed to postMessage to opener:', e);
          }
          setTimeout(() => {
            window.close();
          }, 2000);
        } else {
          // If in same tab, redirect back to /backup
          setTimeout(() => {
            router.push('/backup');
          }, 2500);
        }
      } catch (err: any) {
        console.error('Failed to exchange Google OAuth code:', err);
        setLoading(false);
        setErrorMessage(err.message || 'Failed to exchange authorization code.');
      }
    };

    exchangeCode();
  }, [code, error, router]);

  return (
    <div className="min-h-screen bg-tally-bg text-white flex flex-col items-center justify-center p-6">
      <div className="glass-card rounded-2xl p-8 max-w-md w-full border border-tally-border bg-tally-card text-center space-y-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl -mr-10 -mt-10" />

        {loading && (
          <div className="space-y-4 py-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-white">Connecting Google Drive...</h2>
            <p className="text-xs text-tally-textMuted">
              Verifying authorization and securing single-container cloud link.
            </p>
          </div>
        )}

        {!loading && success && (
          <div className="space-y-4 py-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Google Drive Connected!</h2>
            <p className="text-xs text-emerald-400 font-semibold font-mono bg-emerald-500/10 py-1.5 px-3 rounded-lg border border-emerald-500/20 inline-block">
              {userEmail}
            </p>
            <p className="text-xs text-tally-textMuted leading-relaxed">
              Your Google Drive account has been verified. The single master container will now automatically sync according to your schedule.
            </p>
            <p className="text-xs text-emerald-400/90 font-medium">
              ✓ Connection verified! You can now close this browser tab and return to the Tally Desktop application.
            </p>
            <div className="pt-2">
              <Link
                href="/backup"
                className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-tally-bg font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all"
              >
                <span>Return to Backup Page</span>
              </Link>
            </div>
          </div>
        )}

        {!loading && errorMessage && (
          <div className="space-y-4 py-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Connection Failed</h2>
            <p className="text-xs text-red-400 bg-red-500/10 p-3 rounded-xl border border-red-500/20 font-mono text-left leading-relaxed">
              {errorMessage}
            </p>
            <div className="pt-2">
              <Link
                href="/backup"
                className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-tally-border hover:bg-tally-cardHover text-white font-semibold text-xs transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Backup Settings</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-tally-bg text-white flex items-center justify-center">
          <div className="flex items-center gap-2 text-cyan-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Loading authentication redirect...</span>
          </div>
        </div>
      }
    >
      <RedirectContent />
    </Suspense>
  );
}
