import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  PlusCircle, 
  Search, 
  Edit3, 
  Trash2, 
  ExternalLink, 
  Star, 
  Download, 
  Layers, 
  ShieldCheck, 
  HardDrive, 
  Activity, 
  Sparkles, 
  AlertTriangle,
  RefreshCw,
  Eye,
  Settings,
  Folder
} from 'lucide-react';
import { api } from '../services/api';
import { PlatformIcon } from '../components/AppCard';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, appsRes] = await Promise.all([
        api.getAdminStats(),
        api.getAdminApps({ search, status: statusFilter })
      ]);
      setStats(statsRes);

      // Keep client localStorage cache synchronized with live server apps
      if (Array.isArray(appsRes)) {
        try {
          localStorage.setItem('myapps_catalog_cache', JSON.stringify(appsRes));
        } catch {}
      }

      setApps(appsRes || []);
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  const handleToggleFeatured = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await api.toggleFeatured(id);
      setApps(prev => prev.map(a => a.id === id ? { ...a, is_featured: res.is_featured } : a));
    } catch (err) {
      alert('Failed to toggle featured status');
    }
  };

  const handleToggleStatus = async (id, currentStatus, e) => {
    e.stopPropagation();
    const newStatus = currentStatus === 'published' ? 'draft' : 'published';
    try {
      await api.updateStatus(id, newStatus);
      setApps(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
      loadData();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteApp(deleteTarget.id);
      // Clean from localStorage cache as well so auto-restore never resurrects deleted apps
      try {
        const cached = JSON.parse(localStorage.getItem('myapps_catalog_cache') || '[]');
        if (Array.isArray(cached)) {
          localStorage.setItem('myapps_catalog_cache', JSON.stringify(cached.filter(a => a.id !== deleteTarget.id)));
        }
      } catch {}
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      alert('Failed to delete application: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Admin Console
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Manage your apps, binaries, changelogs, and download metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/settings"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Settings</span>
          </Link>

          <Link
            to="/admin/apps/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Upload New App</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Total Apps</span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-extrabold text-white">{stats.totalApps}</div>
            <p className="text-[11px] text-slate-500">
              {stats.publishedApps} published • {stats.draftApps} drafts
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Categories</span>
              <Folder className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-white">
              {stats.categories ? stats.categories.length : 0}
            </div>
            <p className="text-[11px] text-emerald-400 font-medium">Organized app groups</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Active Platforms</span>
              <HardDrive className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-extrabold text-white">
              {stats.platforms ? stats.platforms.length : 0}
            </div>
            <p className="text-[11px] text-slate-500">Windows, Android & more</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Featured Showcase</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-white">
              {apps.filter(a => a.is_featured).length}
            </div>
            <p className="text-[11px] text-amber-400/90 font-medium">Promoted on homepage</p>
          </div>
        </div>
      )}

      {/* Apps Management Table Section */}
      <div className="rounded-3xl bg-slate-900/70 border border-slate-800 overflow-hidden shadow-xl">
        {/* Table Filter Controls */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="w-full sm:w-80 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by title or tagline..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs text-slate-400">Status:</span>
            <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
              {['all', 'published', 'draft'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-lg capitalize transition-colors ${
                    statusFilter === s ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Application</th>
                <th className="py-3.5 px-4">Platform & Category</th>
                <th className="py-3.5 px-4">Version / Size</th>
                <th className="py-3.5 px-4 text-center">Featured</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Loading apps...
                  </td>
                </tr>
              ) : apps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No apps found. Click "Upload New App" to get started!
                  </td>
                </tr>
              ) : (
                apps.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* App Column */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {app.icon_url ? (
                          <img
                            src={app.icon_url}
                            alt=""
                            className="w-10 h-10 rounded-xl object-cover border border-slate-800 bg-slate-800 flex-shrink-0"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = '/demo-icons/default.png';
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-400 font-bold flex items-center justify-center flex-shrink-0 border border-indigo-500/30">
                            {app.title.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <Link
                            to={`/apps/${app.slug}`}
                            className="font-semibold text-white hover:text-indigo-400 transition-colors truncate block"
                          >
                            {app.title}
                          </Link>
                          <span className="text-[11px] text-slate-500 truncate block">
                            /{app.slug}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Platform & Category */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
                          <PlatformIcon platform={app.platform} className="w-3 h-3" />
                          {app.platform}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {app.category}
                        </span>
                      </div>
                    </td>

                    {/* Version / Size */}
                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      <div className="text-white">v{app.version}</div>
                      <div className="text-slate-500">{app.file_size || 'N/A'}</div>
                    </td>

                    {/* Featured Star Toggle */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={(e) => handleToggleFeatured(app.id, e)}
                        title={app.is_featured ? 'Remove from featured' : 'Mark as featured'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          app.is_featured
                            ? 'text-amber-400 hover:text-amber-300 bg-amber-400/10'
                            : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${app.is_featured ? 'fill-amber-400' : ''}`} />
                      </button>
                    </td>

                    {/* Status Badge Toggle */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={(e) => handleToggleStatus(app.id, app.status, e)}
                        title="Click to toggle status"
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                          app.status === 'published'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'
                        }`}
                      >
                        {app.status}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/apps/${app.slug}`}
                          title="View live page"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <Link
                          to={`/admin/apps/${app.id}/edit`}
                          title="Edit app details and update files"
                          className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => setDeleteTarget(app)}
                          title="Delete app"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-white">Delete "{deleteTarget.title}"?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                This will permanently delete this application, its metadata, and uploaded binary files from the server. This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteConfirm}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-rose-600/30"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete App'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
