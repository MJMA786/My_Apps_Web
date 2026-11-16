import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Download, 
  Star, 
  ExternalLink, 
  Share2, 
  Calendar, 
  HardDrive, 
  ShieldCheck, 
  ChevronRight, 
  CheckCircle, 
  Info, 
  Clock, 
  FileCode, 
  Eye, 
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { PlatformIcon } from '../components/AppCard';
import AppCard from '../components/AppCard';
import ScreenshotModal from '../components/ScreenshotModal';

export default function AppDetailPage() {
  const { slug } = useParams();
  const [app, setApp] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedScreenshotIndex, setSelectedScreenshotIndex] = useState(null);
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    async function loadAppDetails() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getAppBySlug(slug);
        setApp(data.app);
        setRelated(data.related || []);
      } catch (err) {
        setError('Application not found or unavailable.');
      } finally {
        setLoading(false);
      }
    }
    loadAppDetails();
    window.scrollTo(0, 0);
  }, [slug]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  const handleDownload = () => {
    if (!app) return;
    window.location.href = api.getDownloadUrl(app.slug);
    // Optimistically bump local download count
    setApp(prev => ({ ...prev, download_count: (prev.download_count || 0) + 1 }));

    // Also update client cached catalog in localStorage so cold recovery uses latest count
    try {
      const cached = JSON.parse(localStorage.getItem('myapps_catalog_cache') || '[]');
      if (Array.isArray(cached) && cached.length > 0) {
        const updated = cached.map(item => {
          if (item.slug === app.slug || item.id === app.id) {
            return { ...item, download_count: (item.download_count || 0) + 1 };
          }
          return item;
        });
        localStorage.setItem('myapps_catalog_cache', JSON.stringify(updated));
      }
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading application profile...</p>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="max-w-xl mx-auto my-20 p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">App Not Found</h2>
        <p className="text-slate-400 text-sm">{error || 'This app may have been unlisted or removed.'}</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Store
        </Link>
      </div>
    );
  }

  const screenshots = Array.isArray(app.screenshots) ? app.screenshots : [];
  const features = Array.isArray(app.features) ? app.features : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-400">
        <Link to="/" className="hover:text-white transition-colors">Store</Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <Link to={`/apps?category=${app.category}`} className="hover:text-white transition-colors">
          {app.category}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-slate-200 truncate">{app.title}</span>
      </nav>

      {/* Main Header Card */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-8 backdrop-blur-md relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* App Icon */}
            <div className="relative">
              {app.icon_url ? (
                <img
                  src={app.icon_url}
                  alt={app.title}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover shadow-2xl border border-slate-700/80 bg-slate-800"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/demo-icons/default.png';
                  }}
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-2xl border border-indigo-400/40">
                  {app.title.charAt(0)}
                </div>
              )}
              {app.is_featured && (
                <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold flex items-center gap-1 shadow-md">
                  <Sparkles className="w-3 h-3 fill-slate-950" /> Featured
                </span>
              )}
            </div>

            {/* Title & Meta */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  <PlatformIcon platform={app.platform} />
                  {app.platform}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
                  {app.category}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-800 text-slate-400 border border-slate-700/60">
                  v{app.version}
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                {app.title}
              </h1>

              <p className="text-slate-400 text-sm">
                Created & maintained by{' '}
                <span className="text-slate-200 font-medium">{app.developer || 'Official Developer'}</span>
                {app.website_url && (
                  <a
                    href={app.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 ml-2 text-indigo-400 hover:text-indigo-300 text-xs font-medium"
                  >
                    <span>Website</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </p>

              {/* Tagline */}
              {app.tagline && (
                <p className="text-slate-300 text-sm max-w-2xl leading-relaxed pt-1">
                  {app.tagline}
                </p>
              )}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="w-full md:w-auto flex flex-col sm:flex-row md:flex-col gap-3 flex-shrink-0">
            <button
              onClick={handleDownload}
              className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-95"
            >
              {app.is_external_link ? <ExternalLink className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              <span>{app.is_external_link ? 'Get from External Mirror' : 'Download Now'}</span>
              {app.file_size && (
                <span className="text-xs font-normal opacity-80">({app.file_size})</span>
              )}
            </button>

            <button
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copiedShare ? 'Link Copied to Clipboard!' : 'Share Application'}</span>
            </button>
          </div>
        </div>

        {/* Quick Spec Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-800 text-amber-400">
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
            <div>
              <p className="text-slate-400 font-medium">Rating</p>
              <p className="text-white font-semibold text-sm">{app.rating ? app.rating.toFixed(1) : '5.0'} / 5.0</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-800 text-indigo-400">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <p className="text-slate-400 font-medium">Total Downloads</p>
              <p className="text-white font-semibold text-sm">{(app.download_count || 0).toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-800 text-purple-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <p className="text-slate-400 font-medium">Package Size</p>
              <p className="text-white font-semibold text-sm">{app.file_size || 'Varies by device'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-800 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-slate-400 font-medium">Safety Status</p>
              <p className="text-emerald-400 font-semibold text-sm">Verified Clean</p>
            </div>
          </div>
        </div>
      </div>

      {/* Screenshots Showcase */}
      {screenshots.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-400" />
              <span>Screenshots & Interface Preview</span>
            </h2>
            <span className="text-xs text-slate-400">Click to expand</span>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
            {screenshots.map((imgUrl, index) => (
              <div
                key={index}
                onClick={() => setSelectedScreenshotIndex(index)}
                className="flex-shrink-0 cursor-pointer group relative rounded-2xl overflow-hidden border border-slate-800 hover:border-indigo-500/60 shadow-lg transition-all"
              >
                <img
                  src={imgUrl}
                  alt={`${app.title} screenshot ${index + 1}`}
                  className="h-56 w-auto object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="px-3 py-1.5 rounded-lg bg-black/70 text-white text-xs font-medium backdrop-blur-sm">
                    View Fullscreen
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Description, Features, Changelog */}
        <div className="lg:col-span-2 space-y-8">
          {/* About / Description */}
          <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 sm:p-8 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Info className="w-5 h-5 text-indigo-400" />
              <span>About {app.title}</span>
            </h3>

            <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line space-y-3 prose prose-invert max-w-none">
              {app.description || 'No detailed description provided.'}
            </div>
          </div>

          {/* Key Features List */}
          {features.length > 0 && (
            <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 sm:p-8 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>Key Features & Capabilities</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {features.map((feature, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 text-xs text-slate-200"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Changelog / Release Notes */}
          {app.changelog && (
            <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 sm:p-8 space-y-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                <span>What's New in Version {app.version}</span>
              </h3>
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                {app.changelog}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Technical Specs & Requirements */}
        <div className="space-y-6">
          {/* Technical Specs Card */}
          <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Technical Specifications
            </h3>

            <div className="divide-y divide-slate-800/80">
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Version</span>
                <span className="text-white font-medium">{app.version}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Target Platform</span>
                <span className="text-white font-medium">{app.platform}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Category</span>
                <span className="text-white font-medium">{app.category}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">File Name</span>
                <span className="text-white font-mono truncate max-w-[160px]" title={app.file_name}>
                  {app.file_name || 'installer-package'}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">License</span>
                <span className="text-white font-medium">Free / Full Version</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Release Date</span>
                <span className="text-white font-medium">
                  {new Date(app.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* System Requirements Card */}
          {app.system_requirements && (
            <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 space-y-3 text-xs">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                System Requirements
              </h3>
              <p className="text-slate-300 leading-relaxed bg-slate-950/50 p-3.5 rounded-xl border border-slate-800">
                {app.system_requirements}
              </p>
            </div>
          )}

          {/* Safe & Verified Badge */}
          <div className="rounded-3xl bg-gradient-to-br from-emerald-950/30 to-slate-900 border border-emerald-500/20 p-6 space-y-3">
            <div className="flex items-center gap-3 text-emerald-400 font-semibold text-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Safety Guarantee</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every package is analyzed for security before distribution. 
              Zero bundled adware, spyware, or third-party toolbars.
            </p>
          </div>
        </div>
      </div>

      {/* Related Apps */}
      {related.length > 0 && (
        <section className="space-y-4 pt-6 border-t border-slate-800">
          <h2 className="text-xl font-bold text-white">
            More in {app.category}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map((rel) => (
              <AppCard key={rel.id} app={rel} />
            ))}
          </div>
        </section>
      )}

      {/* Screenshot Lightbox Modal */}
      <ScreenshotModal
        screenshots={screenshots}
        selectedIndex={selectedScreenshotIndex}
        onClose={() => setSelectedScreenshotIndex(null)}
        onSelectIndex={setSelectedScreenshotIndex}
      />
    </div>
  );
}
