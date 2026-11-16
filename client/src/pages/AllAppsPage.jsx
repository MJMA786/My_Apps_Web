import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, ArrowUpDown, SlidersHorizontal, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import AppCard from '../components/AppCard';

export default function AllAppsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [apps, setApps] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || 'All';
  const platform = searchParams.get('platform') || 'All';
  const sort = searchParams.get('sort') || 'popular';

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'All') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
  };

  useEffect(() => {
    async function fetchApps() {
      setLoading(true);
      try {
        const data = await api.getApps({
          search,
          category,
          platform,
          sort,
          limit: 36
        });
        setApps(data.apps || []);
        setTotal(data.pagination ? data.pagination.total : (data.apps ? data.apps.length : 0));
      } catch (err) {
        console.error('Failed to load apps:', err);
        try {
          const cached = JSON.parse(localStorage.getItem('myapps_catalog_cache') || '[]');
          if (cached.length > 0) {
            setApps(cached);
            setTotal(cached.length);
          }
        } catch {}
      } finally {
        setLoading(false);
      }
    }

    fetchApps();
  }, [search, category, platform, sort]);

  const categories = ['All', 'Productivity', 'Utilities', 'Developer Tools', 'Multimedia', 'Security', 'Games'];
  const platforms = ['All', 'Windows', 'Android', 'Cross-Platform', 'macOS', 'Linux', 'Web'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Application Repository
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Browse through all published versions, installers, and packages.
          </p>
        </div>

        {/* Search in Catalog */}
        <div className="w-full md:w-80 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search all apps..."
            value={search}
            onChange={(e) => updateParam('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm text-white placeholder-slate-400 outline-none"
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-4">
          {/* Category Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Category:</span>
            <select
              value={category}
              onChange={(e) => updateParam('category', e.target.value)}
              className="bg-slate-800 text-slate-200 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Platform Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Platform:</span>
            <select
              value={platform}
              onChange={(e) => updateParam('platform', e.target.value)}
              className="bg-slate-800 text-slate-200 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {platforms.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3" /> Sort by:
          </span>
          <select
            value={sort}
            onChange={(e) => updateParam('sort', e.target.value)}
            className="bg-slate-800 text-slate-200 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="popular">Recommended</option>
            <option value="newest">Latest Added</option>
            <option value="rating">Top Rated</option>
            <option value="name">Name (A-Z)</option>
          </select>

          {(search || category !== 'All' || platform !== 'All') && (
            <button
              onClick={() => setSearchParams({})}
              className="text-xs text-indigo-400 hover:text-indigo-300 ml-2 font-medium"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Results summary */}
      <div className="text-xs text-slate-400 flex items-center justify-between">
        <span>Found {total} application{total === 1 ? '' : 's'}</span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Retrieving catalog...</p>
        </div>
      ) : apps.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {apps.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">
            {search || category !== 'All' || platform !== 'All' ? 'No results found' : 'Repository is Empty'}
          </h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto mt-1">
            {search || category !== 'All' || platform !== 'All'
              ? 'No applications match your selected criteria. Try adjusting filters or clearing search.'
              : 'No applications have been published to the catalog yet.'}
          </p>
        </div>
      )}
    </div>
  );
}
