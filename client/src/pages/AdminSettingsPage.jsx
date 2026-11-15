import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  ArrowLeft, 
  User, 
  KeyRound, 
  CheckCircle2, 
  ShieldAlert, 
  Database, 
  Server, 
  HardDrive, 
  Cloud, 
  Check, 
  RefreshCw, 
  ExternalLink,
  FolderCheck,
  HelpCircle,
  Folder,
  Copy,
  LogOut,
  Sparkles
} from 'lucide-react';

export default function AdminSettingsPage() {
  const { user, refreshUser } = useAuth();

  // Profile states
  const [displayName, setDisplayName] = useState(user?.displayName || 'Administrator');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Google Drive states
  const [driveStatus, setDriveStatus] = useState({ configured: false });
  const [driveTestResult, setDriveTestResult] = useState(null);
  const [activeTab, setActiveTab] = useState('oauth'); // 'oauth' | 'service_account'
  
  const getStoredAuth = () => {
    try {
      return JSON.parse(localStorage.getItem('myapps_drive_auth') || '{}');
    } catch {
      return {};
    }
  };

  const storedAuth = getStoredAuth();
  // OAuth 2.0 states
  const [clientIdInput, setClientIdInput] = useState(() => storedAuth.clientId || localStorage.getItem('myapps_drive_client_id') || '');
  const [clientSecretInput, setClientSecretInput] = useState(() => storedAuth.clientSecret || localStorage.getItem('myapps_drive_client_secret') || '');
  const [folderIdInput, setFolderIdInput] = useState(() => storedAuth.folderId || localStorage.getItem('myapps_drive_folder_id') || '');
  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copiedRedirectUri, setCopiedRedirectUri] = useState(false);
  const [copiedVercelEnv, setCopiedVercelEnv] = useState(false);

  // Service Account states (Legacy)
  const [keyJsonInput, setKeyJsonInput] = useState('');
  const [savingServiceAccount, setSavingServiceAccount] = useState(false);
  const [testingDrive, setTestingDrive] = useState(false);
  const [showOAuthGuide, setShowOAuthGuide] = useState(false);
  const [showServiceGuide, setShowServiceGuide] = useState(false);

  // Common UI states
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dynamically determine redirect URI based on current browser origin
  const redirectUri = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/admin/drive/callback`
    : '/api/admin/drive/callback';

  // Load status & handle OAuth return URL params
  const loadDriveStatus = async () => {
    try {
      let stored = null;
      try {
        stored = JSON.parse(localStorage.getItem('myapps_drive_auth') || 'null');
      } catch {}

      let status = await api.getDriveStatus();

      // If server does not report configured or oauthConnected, but browser has tokens stored, sync them!
      if ((!status.configured || !status.oauthConnected) && stored && stored.tokens) {
        try {
          const syncRes = await api.syncDriveAuth(stored);
          if (syncRes.status) {
            status = syncRes.status;
          }
        } catch (syncErr) {
          console.warn('Auto-sync drive auth error:', syncErr);
        }
      }

      setDriveStatus(status);
      if (status.folderId) {
        setFolderIdInput(status.folderId);
      }
      if (status.oauthClientId) {
        setClientIdInput(status.oauthClientId);
      }
      if (status.configured) {
        try {
          const test = await api.testDriveConnection();
          setDriveTestResult(test);
        } catch (testErr) {
          setDriveTestResult({ error: testErr.message });
        }
      }
    } catch (err) {
      console.warn('Could not fetch drive status:', err);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('drive_connected')) {
      setSuccess('Google Drive connected successfully to your personal account!');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (params.get('error')) {
      setError('Google OAuth Error: ' + params.get('error'));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    loadDriveStatus();
  }, []);

  // Copy redirect URI helper
  const handleCopyRedirectUri = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(redirectUri);
      setCopiedRedirectUri(true);
      setTimeout(() => setCopiedRedirectUri(false), 2500);
    }
  };

  // Copy Vercel environment variables helper
  const handleCopyVercelEnv = () => {
    const stored = getStoredAuth();
    const tokens = driveStatus.tokens || stored.tokens;
    const cid = clientIdInput || driveStatus.oauthClientId || stored.clientId || '';
    const secret = clientSecretInput || stored.clientSecret || '';
    const fid = folderIdInput || driveStatus.folderId || stored.folderId || '';

    const lines = [
      cid ? `GOOGLE_OAUTH_CLIENT_ID=${cid}` : '',
      secret ? `GOOGLE_OAUTH_CLIENT_SECRET=${secret}` : '',
      tokens ? `GOOGLE_OAUTH_TOKENS=${typeof tokens === 'string' ? tokens : JSON.stringify(tokens)}` : '',
      fid ? `GOOGLE_DRIVE_FOLDER_ID=${fid}` : ''
    ].filter(Boolean).join('\n');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(lines);
      setCopiedVercelEnv(true);
      setTimeout(() => setCopiedVercelEnv(false), 2500);
    }
  };

  // Start Google OAuth 2.0 Authorization Flow
  const handleStartGoogleOAuth = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!clientIdInput.trim() || !clientSecretInput.trim()) {
      setError('Both Google OAuth Client ID and Client Secret are required.');
      return;
    }

    try {
      localStorage.setItem('myapps_drive_client_id', clientIdInput.trim());
      localStorage.setItem('myapps_drive_client_secret', clientSecretInput.trim());
      localStorage.setItem('myapps_drive_folder_id', folderIdInput.trim());
    } catch {}

    setConnectingOAuth(true);
    try {
      const res = await api.getDriveOAuthUrl({
        clientId: clientIdInput.trim(),
        clientSecret: clientSecretInput.trim(),
        folderId: folderIdInput.trim(),
        customRedirectUri: redirectUri
      });

      if (res.authUrl) {
        // Redirect browser to Google's official OAuth consent screen
        window.location.href = res.authUrl;
      } else {
        throw new Error('Google did not return an authorization URL.');
      }
    } catch (err) {
      setError(err.message || 'Failed to initiate Google OAuth.');
      setConnectingOAuth(false);
    }
  };

  // Disconnect Google Account
  const handleDisconnectDrive = async () => {
    if (!window.confirm('Are you sure you want to disconnect Google Drive?')) return;
    setDisconnecting(true);
    setError('');
    setSuccess('');
    try {
      await api.disconnectDriveOAuth();
      setSuccess('Google Drive disconnected.');
      setDriveTestResult(null);
      await loadDriveStatus();
    } catch (err) {
      setError(err.message || 'Failed to disconnect Google Drive.');
    } finally {
      setDisconnecting(false);
    }
  };

  // Save Service Account Key (Legacy alternative)
  const handleSaveServiceAccount = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!keyJsonInput.trim()) {
      setError('Please provide your Google Service Account JSON key.');
      return;
    }

    setSavingServiceAccount(true);
    try {
      const res = await api.saveDriveConfig({
        keyJson: keyJsonInput.trim(),
        folderId: folderIdInput.trim()
      });
      setSuccess('Service Account key saved and verified!');
      setKeyJsonInput('');
      await loadDriveStatus();
    } catch (err) {
      setError(err.message || 'Failed to save Service Account.');
    } finally {
      setSavingServiceAccount(false);
    }
  };

  // Manual Test Button
  const handleTestDrive = async () => {
    setTestingDrive(true);
    setError('');
    try {
      const test = await api.testDriveConnection();
      setDriveTestResult(test);
      setSuccess('Google Drive connection verified successfully!');
    } catch (err) {
      setError('Google Drive test failed: ' + err.message);
    } finally {
      setTestingDrive(false);
    }
  };

  // Update Admin Profile / Password
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword) {
      if (!currentPassword) {
        setError('Current password is required to set a new password.');
        return;
      }
      if (newPassword.length < 6) {
        setError('New password must be at least 6 characters long.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('New password and confirmation do not match.');
        return;
      }
    }

    setSavingProfile(true);
    try {
      await api.updateProfile({
        displayName,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined
      });
      setSuccess('Profile updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await refreshUser();
    } catch (err) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setSavingProfile(false);
    }
  };

  const formatStorage = (bytes) => {
    if (!bytes || isNaN(bytes)) return 'Unknown';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb < 1) {
      const mb = bytes / (1024 * 1024);
      return `${mb.toFixed(1)} MB`;
    }
    return `${gb.toFixed(2)} GB`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 pb-6 border-b border-slate-800">
        <Link
          to="/admin"
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Administrator Settings
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage admin credentials, Google Drive personal account connection, and platform settings.
          </p>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* SECTION 1: Google Drive Storage Integration */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Google Drive Cloud Storage</span>
                {driveStatus.configured ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {driveStatus.authType === 'oauth' ? 'Personal Account Active' : 'Service Account Active'}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Not Connected
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload APKs and software installers to your Google Drive with full automatic cleanup on app deletion.
              </p>
            </div>
          </div>

          {driveStatus.configured && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestDrive}
                disabled={testingDrive}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingDrive ? 'animate-spin' : ''}`} />
                <span>Test Connection</span>
              </button>
              <button
                type="button"
                onClick={handleDisconnectDrive}
                disabled={disconnecting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          )}
        </div>

        {/* Live Drive Connected Details */}
        {driveStatus.configured && (
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500 block text-[11px]">Connected Google Account:</span>
                <span className="text-white font-mono text-[11px] font-semibold truncate block" title={driveStatus.clientEmail}>
                  {driveStatus.clientEmail || 'Google Account'}
                </span>
                <span className="text-[10px] text-emerald-400">
                  {driveStatus.authType === 'oauth' ? 'Personal Account (Full 15GB Quota)' : 'Service Account'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Destination Folder:</span>
                <span className="text-emerald-400 font-medium">
                  {driveTestResult?.folderName || driveStatus.folderId || 'Root / Default'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Google Drive Storage:</span>
                <span className="text-slate-200 font-medium">
                  {driveTestResult?.storageQuota?.limit 
                    ? `${formatStorage(driveTestResult.storageQuota.usage)} used of ${formatStorage(driveTestResult.storageQuota.limit)}`
                    : 'Active & Accessible'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-900 text-[11px] text-emerald-400">
              <span className="flex items-center gap-1.5 font-medium">
                <Check className="w-3.5 h-3.5" /> 
                Direct browser upload active — files stream straight to your Google Drive, bypassing Vercel limits!
              </span>
            </div>

            {/* Permanent Vercel Server Storage */}
            <div className="mt-3 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">☁️</span>
                  <span className="font-bold text-white text-xs">Permanent Vercel Server Storage</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                    Zero-Maintenance
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyVercelEnv}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedVercelEnv ? 'Copied to Clipboard!' : 'Copy Vercel Env'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Your browser currently preserves these credentials automatically in local storage so you stay connected on this device. To keep Google Drive connected across all devices and browsers without ever having to reconnect, copy and paste these into your <strong>Vercel Dashboard &rarr; Settings &rarr; Environment Variables</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Connection Mode Selection (Tabs) */}
        {!driveStatus.configured && (
          <div className="space-y-5 pt-2">
            <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-950 border border-slate-800 max-w-md text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('oauth')}
                className={`flex-1 py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'oauth' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Personal Google Account (Recommended)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('service_account')}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  activeTab === 'service_account' 
                    ? 'bg-slate-800 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Service Account
              </button>
            </div>

            {/* TAB A: Personal Google Account (OAuth 2.0) */}
            {activeTab === 'oauth' && (
              <form onSubmit={handleStartGoogleOAuth} className="space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 text-slate-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Sign in with your @gmail.com (Uses your 15 GB Free Storage)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowOAuthGuide(!showOAuthGuide)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
                    >
                      {showOAuthGuide ? 'Hide Instructions' : 'View Google Cloud Setup (2 mins)'}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    By signing in with your Google account, apps you upload will be stored directly inside your personal 15 GB Google Drive, avoiding any bot quota restrictions.
                  </p>

                  {/* Copy Redirect URI Card */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Your Authorized Redirect URI (Copy this into Google Cloud Console):
                    </span>
                    <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-indigo-300 bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-800">
                      <span className="truncate">{redirectUri}</span>
                      <button
                        type="button"
                        onClick={handleCopyRedirectUri}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-sans text-[11px] font-semibold transition-colors flex-shrink-0"
                      >
                        {copiedRedirectUri ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy URI</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Step-by-Step Instructions Dropdown */}
                  {showOAuthGuide && (
                    <div className="pt-2 border-t border-indigo-500/20 space-y-2 text-[11px] text-slate-300">
                      <p className="font-semibold text-indigo-300">Google Cloud Console Setup Steps:</p>
                      <ol className="list-decimal list-inside space-y-1.5 leading-relaxed text-slate-300">
                        <li>
                          Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-indigo-400 underline font-semibold">Google Cloud Credentials</a>.
                        </li>
                        <li>
                          Click <strong>+ Create Credentials</strong> ➔ <strong>OAuth client ID</strong>.
                        </li>
                        <li>
                          Application type: Choose <strong>Web application</strong>.
                        </li>
                        <li>
                          Under <strong>Authorized redirect URIs</strong>, paste the Redirect URI copied above.
                        </li>
                        <li>
                          Click <strong>Create</strong> ➔ Copy your <strong>Client ID</strong> and <strong>Client Secret</strong> into the fields below!
                        </li>
                      </ol>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      OAuth Client ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={clientIdInput}
                      onChange={(e) => setClientIdInput(e.target.value)}
                      placeholder="e.g. 123456789-xxx.apps.googleusercontent.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-[11px] placeholder-slate-600 focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      OAuth Client Secret *
                    </label>
                    <input
                      type="password"
                      required
                      value={clientSecretInput}
                      onChange={(e) => setClientSecretInput(e.target.value)}
                      placeholder="GOCSPX-xxxxxxxxxxxxxx"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-[11px] placeholder-slate-600 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Google Drive Folder ID or Folder Link (Optional, Recommended)
                  </label>
                  <input
                    type="text"
                    value={folderIdInput}
                    onChange={(e) => setFolderIdInput(e.target.value)}
                    placeholder="e.g. 1EOubcUIMc0Sgbq58e0wW5XsIgieON5-Z or paste full folder link"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-[11px] placeholder-slate-600 focus:border-indigo-500 outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Paste the folder link or ID from your Google Drive. Uploaded APKs will be neatly organized inside this folder.
                  </p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={connectingOAuth}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 transition-all disabled:opacity-50"
                  >
                    {connectingOAuth ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Redirecting to Google...</span>
                      </>
                    ) : (
                      <>
                        <Cloud className="w-4 h-4" />
                        <span>Sign in with Google Drive</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* TAB B: Service Account (Legacy fallback) */}
            {activeTab === 'service_account' && (
              <form onSubmit={handleSaveServiceAccount} className="space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300">Service Account Key (Google Workspace Shared Drives)</span>
                    <button
                      type="button"
                      onClick={() => setShowServiceGuide(!showServiceGuide)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
                    >
                      {showServiceGuide ? 'Hide Guide' : 'Setup Guide'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Note: Google does not grant free quota to bot Service Accounts on standard personal @gmail.com accounts. If you have a personal account, use the <strong>Personal Google Account</strong> tab above instead.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-300 font-medium">
                      Service Account Key JSON
                    </label>
                    <label className="cursor-pointer text-indigo-400 hover:text-indigo-300 text-[11px] font-medium">
                      <span>Upload key .json file</span>
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => setKeyJsonInput(event.target.result);
                            reader.readAsText(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <textarea
                    rows={4}
                    value={keyJsonInput}
                    onChange={(e) => setKeyJsonInput(e.target.value)}
                    placeholder='{ "type": "service_account", ... }'
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-[11px] placeholder-slate-600 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    Shared Drive Folder ID
                  </label>
                  <input
                    type="text"
                    value={folderIdInput}
                    onChange={(e) => setFolderIdInput(e.target.value)}
                    placeholder="e.g. 1EOubcUIMc0Sgbq58e0wW5XsIgieON5-Z"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono placeholder-slate-600 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingServiceAccount}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
                  >
                    {savingServiceAccount ? 'Saving...' : 'Save Service Account'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* SECTION 2: Admin Profile & Credentials */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <form onSubmit={handleUpdateProfile} className="rounded-3xl bg-slate-900/70 border border-slate-800 p-6 sm:p-8 space-y-5 text-xs">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-400" />
              <span>Admin Profile & Security</span>
            </h2>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Username
              </label>
              <input
                type="text"
                disabled
                value={user?.username || 'admin'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-400 cursor-not-allowed outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Administrator"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500 outline-none"
              />
            </div>

            <div className="pt-4 border-t border-slate-800/80 space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Change Password (Leave blank to keep current)</span>
              </h3>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-md shadow-indigo-600/30"
              >
                {savingProfile ? 'Saving changes...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Storage Architecture Summary */}
        <div className="space-y-6 text-xs">
          <div className="rounded-3xl bg-slate-900/70 border border-slate-800 p-6 space-y-4">
            <h3 className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              <span>Storage Flow</span>
            </h3>

            <div className="divide-y divide-slate-800/80 text-[11px] leading-relaxed">
              <div className="py-2.5">
                <span className="text-slate-400 block font-medium">When you upload:</span>
                <span className="text-slate-300">
                  Files are streamed directly to your Google Drive folder and made publicly downloadable.
                </span>
              </div>
              <div className="py-2.5">
                <span className="text-slate-400 block font-medium">When you delete an app:</span>
                <span className="text-emerald-400">
                  The file is automatically deleted from Google Drive, immediately freeing your storage!
                </span>
              </div>
              <div className="py-2.5">
                <span className="text-slate-400 block font-medium">When users download:</span>
                <span className="text-slate-300">
                  Fast direct download from Google's high-speed global servers.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
