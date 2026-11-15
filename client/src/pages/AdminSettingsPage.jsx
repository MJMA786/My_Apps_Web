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
  Folder
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
  const [keyJsonInput, setKeyJsonInput] = useState('');
  const [folderIdInput, setFolderIdInput] = useState('');
  const [savingDrive, setSavingDrive] = useState(false);
  const [testingDrive, setTestingDrive] = useState(false);
  const [showDriveGuide, setShowDriveGuide] = useState(false);

  // Common UI states
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load Google Drive status on mount
  useEffect(() => {
    async function loadDriveStatus() {
      try {
        const status = await api.getDriveStatus();
        setDriveStatus(status);
        if (status.folderId) {
          setFolderIdInput(status.folderId);
        }
        if (status.configured) {
          try {
            const test = await api.testDriveConnection();
            setDriveTestResult(test);
          } catch {}
        }
      } catch (err) {
        console.warn('Could not fetch drive status:', err);
      }
    }
    loadDriveStatus();
  }, []);

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

  // Handle Google Drive JSON File Upload
  const handleKeyFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setKeyJsonInput(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  // Test & Save Google Drive Configuration
  const handleSaveDriveConfig = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!keyJsonInput.trim()) {
      setError('Please provide your Google Service Account JSON key.');
      return;
    }

    setSavingDrive(true);
    try {
      const res = await api.saveDriveConfig({
        keyJson: keyJsonInput.trim(),
        folderId: folderIdInput.trim()
      });
      setSuccess('Google Drive connected and verified successfully!');
      setDriveStatus({ configured: true, clientEmail: res.testResult?.user?.emailAddress, folderId: folderIdInput.trim() });
      setDriveTestResult(res.testResult);
      setKeyJsonInput('');
    } catch (err) {
      setError(err.message || 'Failed to connect Google Drive.');
    } finally {
      setSavingDrive(false);
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

  const formatStorage = (bytes) => {
    if (!bytes || isNaN(bytes)) return 'Unlimited / Unknown';
    const gb = bytes / (1024 * 1024 * 1024);
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
            Manage admin credentials, Google Drive cloud storage, and platform diagnostics.
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

      {/* SECTION 1: Google Drive Cloud Storage Integration */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Google Drive Storage Integration</span>
                {driveStatus.configured ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Active & Connected
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Not Connected (Setup Required)
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically upload app packages to your Google Drive and delete them from Drive when removed from the site.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowDriveGuide(!showDriveGuide)}
            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showDriveGuide ? 'Hide Setup Guide' : 'How to set up (3 Steps)'}</span>
          </button>
        </div>

        {/* Step-by-Step Guide Dropdown */}
        {showDriveGuide && (
          <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 text-xs text-slate-300 space-y-3">
            <h4 className="font-bold text-indigo-300 uppercase tracking-wider text-[11px]">
              How to Connect Your Free Google Drive Account:
            </h4>
            <ol className="list-decimal list-inside space-y-2 leading-relaxed">
              <li>
                <strong>Create Service Account:</strong> Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-indigo-400 underline font-medium">Google Cloud Console</a>, create a project (or use existing), enable the <strong>Google Drive API</strong>, go to <strong>Credentials</strong> → <strong>Create Credentials</strong> → <strong>Service Account</strong>.
              </li>
              <li>
                <strong>Download JSON Key:</strong> In your Service Account details, go to the <strong>Keys</strong> tab → <strong>Add Key</strong> → <strong>Create new key</strong> (JSON). Save the file to your computer.
              </li>
              <li>
                <strong>Share your Drive Folder:</strong> In your personal Google Drive, create a folder (e.g. <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300 font-mono">MyApps_Storage</code>), click <strong>Share</strong>, and add your Service Account email with <strong>"Editor"</strong> permission.
              </li>
            </ol>
            <p className="text-[11px] text-slate-400 pt-1">
              Copy the Folder ID from the Drive folder's URL (e.g. <code className="bg-slate-900 px-1 py-0.5 rounded text-slate-300">drive.google.com/drive/folders/<strong>1aBcD...</strong></code>) and paste it below.
            </p>
          </div>
        )}

        {/* Live Drive Connected Details */}
        {driveStatus.configured && (
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500 block text-[11px]">Service Account Email:</span>
                <span className="text-white font-mono text-[11px] truncate block" title={driveStatus.clientEmail}>
                  {driveStatus.clientEmail || 'Configured via JSON'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Destination Folder:</span>
                <span className="text-emerald-400 font-medium">
                  {driveTestResult?.folderName || driveStatus.folderId || 'Root / Default'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Storage Status:</span>
                <span className="text-slate-200">
                  {driveTestResult?.storageQuota?.usage 
                    ? `${formatStorage(driveTestResult.storageQuota.usage)} used`
                    : 'Active & Accessible'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-900">
              <span className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium">
                <Check className="w-3.5 h-3.5" /> All new app uploads will automatically stream to this Google Drive.
              </span>
              <button
                type="button"
                onClick={handleTestDrive}
                disabled={testingDrive}
                className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
              >
                <RefreshCw className={`w-3 h-3 ${testingDrive ? 'animate-spin' : ''}`} />
                <span>Test Connection</span>
              </button>
            </div>
          </div>
        )}

        {/* Drive Config Form */}
        <form onSubmit={handleSaveDriveConfig} className="space-y-4 text-xs pt-2">
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
                  onChange={handleKeyFileUpload}
                  className="hidden"
                />
              </label>
            </div>
            <textarea
              rows={4}
              value={keyJsonInput}
              onChange={(e) => setKeyJsonInput(e.target.value)}
              placeholder='Paste contents of service-account-key.json here: { "type": "service_account", "project_id": "...", ... }'
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-[11px] placeholder-slate-600 focus:border-indigo-500 outline-none leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">
              Google Drive Folder ID (Optional, but recommended)
            </label>
            <input
              type="text"
              value={folderIdInput}
              onChange={(e) => setFolderIdInput(e.target.value)}
              placeholder="e.g. 1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono placeholder-slate-600 focus:border-indigo-500 outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Found in the URL when opening the shared folder in drive.google.com.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingDrive}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-md shadow-emerald-600/30"
            >
              {savingDrive ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying & Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save & Connect Google Drive</span>
                </>
              )}
            </button>
          </div>
        </form>
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
