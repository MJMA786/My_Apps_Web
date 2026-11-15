import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Sparkles, 
  Filter, 
  ArrowUpDown, 
  Download, 
  ShieldCheck, 
  Zap, 
  Layers,
  CheckCircle2,
  AlertCircle,
  Boxes,
  PlusCircle
} from 'lucide-react';
import { api } from '../services/api';
import AppCard, { PlatformIcon } from '../components/AppCard';
import FeaturedCarousel from '../components/FeaturedCarousel';

export default function HomePage() {
  const [apps, setApps] = useState([]);
  const [featuredApps, setFeaturedApps] = useState([]);
  const [categories, setCategories] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPlatform, setSelectedPlatform] = useState('All');
  const [sortBy, setSortBy] = useState('popular');
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    async function loadInitial() {
      try {
        const [featuredRes, catRes, platRes] = await Promise.all([
          api.getFeaturedApps(),
          api.getCategories(),
          api.getPlatforms()
        ]);
        let finalFeatured = featuredRes;
        if (!featuredRes || featuredRes.length === 0) {
          try {
            const cached = JSON.parse(localStorage.getItem('myapps_catalog_cache') || '[]');
            if (cached.length > 0) {
              const feat = cached.filter(a => a.is_featured);
              finalFeatured = feat.length > 0 ? feat : cached.slice(0, 6);
            }
          } catch {}
        }
        setFeaturedApps(finalFeatured || []);
        setCategories(catRes || []);
        setPlatforms(platRes || []);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    }
    loadInitial();
  }, []);

  // Fetch apps based on search & filters
  useEffect(() => {
    async function loadApps() {
      setLoading(true);
      try {
        const data = await api.getApps({
          search,
          category: selectedCategory,
          platform: selectedPlatform,
          sort: sortBy,
          limit: 24
        });
        let appList = data.apps || [];
        if (appList.length === 0 && !search && selectedCategory === 'All' && selectedPlatform === 'All') {
          try {
            const cached = JSON.parse(localStorage.getItem('myapps_catalog_cache') || '[]');
            if (cached.length > 0) appList = cached;
          } catch {}
        }
        setApps(appList);
      } catch (err) {
        console.error('Failed to query apps:', err);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(loadApps, 250);
    return () => clearTimeout(timer);
  }, [search, selectedCategory, selectedPlatform, sortBy]);

  const defaultCategories = ['All', 'Productivity', 'Utilities', 'Developer Tools', 'Multimedia', 'Security', 'Games'];
  const defaultPlatforms = ['All', 'Windows', 'Android', 'Cross-Platform', 'macOS', 'Linux', 'Web'];

  return (
    <div className="min-h-screen space-y-12">
      {/* Hero Section */}
      <section className="relative pt-6 sm:pt-10 pb-6 overflow-hidden">
        {/* Ambient background lights */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-indigo-500/15 via-purple-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

        <div className="max-w-4xl mx-auto text-center space-y-5 px-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/60 shadow-lg text-xs font-semibold text-slate-300">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Direct Safe Downloads • Fast & Clean Binaries</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.15]">
            Discover, Explore & Download{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
              Handcrafted Apps
            </span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            The dedicated distribution portal for desktop programs, Android APKs, and utility tools. 
            All applications are directly hosted with verified releases.
          </p>

          {/* Quick Search Bar */}
          <div className="pt-2 max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search apps by name, purpose, or tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-900/80 border border-slate-700/80 hover:border-indigo-500/50 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-white placeholder-slate-400 text-sm transition-all shadow-xl backdrop-blur-md outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Highlights row */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              One-Click Direct Installer
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Virus & Spyware Scanned
            </span>
            <span className="flex items-center gap-1.5">
              <Download className="w-4 h-4 text-indigo-400" />
              High Speed Mirrors
            </span>
          </div>
        </div>
      </section>

      {/* Featured Showcase */}
      {featuredApps.length > 0 && !search && selectedCategory === 'All' && selectedPlatform === 'All' && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FeaturedCarousel featuredApps={featuredApps} />
        </section>
      )}

      {/* Catalog & Filter Navigation */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Layers className="w-6 h-6 text-indigo-400" />
              <span>Available Applications</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Showing {apps.length} {apps.length === 1 ? 'application' : 'applications'}
              {selectedCategory !== 'All' && ` in ${selectedCategory}`}
              {selectedPlatform !== 'All' && ` for ${selectedPlatform}`}
            </p>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" /> Sort:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="popular">Most Downloaded</option>
              <option value="newest">Latest Release</option>
              <option value="rating">Top Rated</option>
              <option value="name">Alphabetical (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Platform Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider pr-1 flex-shrink-0">
            Platform:
          </span>
          {defaultPlatforms.map((plat) => {
            const isSelected = selectedPlatform === plat;
            return (
              <button
                key={plat}
                onClick={() => setSelectedPlatform(plat)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {plat !== 'All' && <PlatformIcon platform={plat} />}
                <span>{plat}</span>
              </button>
            );
          })}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider pr-1 flex-shrink-0">
            Category:
          </span>
          {defaultCategories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* App Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Loading applications catalog...</p>
          </div>
        ) : apps.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-2">
            {apps.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
            <Boxes className="w-12 h-12 text-indigo-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white">
              {search || selectedCategory !== 'All' || selectedPlatform !== 'All' 
                ? 'No applications match your filter' 
                : 'No Applications Uploaded Yet'}
            </h3>
            <p className="text-slate-400 text-sm max-w-md mx-auto mt-1">
              {search || selectedCategory !== 'All' || selectedPlatform !== 'All' 
                ? 'Try adjusting your search terms, choosing a different category or platform, or resetting filters.' 
                : 'Your platform is clean and ready. Sign in to the Admin Console to upload and publish your first application!'}
            </p>
            {search || selectedCategory !== 'All' || selectedPlatform !== 'All' ? (
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('All');
                  setSelectedPlatform('All');
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
              >
                Reset Filters
              </button>
            ) : (
              <Link
                to="/admin/apps/new"
                className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all hover:scale-105"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Upload First App</span>
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
