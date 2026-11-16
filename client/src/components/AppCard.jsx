import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Download, 
  Star, 
  Monitor, 
  Smartphone, 
  Apple, 
  Layers, 
  Globe, 
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { api } from '../services/api';

// Platform Icon Helper
export function PlatformIcon({ platform, className = "w-3.5 h-3.5" }) {
  const p = (platform || '').toLowerCase();
  if (p.includes('win')) return <Monitor className={className} />;
  if (p.includes('android')) return <Smartphone className={className} />;
  if (p.includes('mac') || p.includes('ios') || p.includes('apple')) return <Apple className={className} />;
  if (p.includes('web')) return <Globe className={className} />;
  return <Layers className={className} />;
}

export default function AppCard({ app, onDownloadClick }) {
  const handleDownload = (e) => {
    e.stopPropagation();
    if (onDownloadClick) {
      onDownloadClick(app);
    } else {
      window.location.href = api.getDownloadUrl(app.slug);
    }
  };

  return (
    <Link
      to={`/apps/${app.slug}`}
      className="group flex flex-col justify-between rounded-2xl bg-slate-900/60 border border-slate-800/90 hover:border-indigo-500/50 p-5 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 backdrop-blur-sm"
    >
      <div>
        {/* Top row: Icon + Platform & Category */}
        <div className="flex items-start gap-4">
          <div className="relative flex-shrink-0">
            {app.icon_url ? (
              <img
                src={app.icon_url}
                alt={app.title}
                className="w-16 h-16 rounded-2xl object-cover shadow-md group-hover:scale-105 transition-transform duration-300 border border-slate-800/80 bg-slate-800"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/demo-icons/default.png';
                }}
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-md border border-slate-700">
                {app.title ? app.title.charAt(0).toUpperCase() : 'A'}
              </div>
            )}

            {app.is_featured && (
              <span 
                title="Featured App"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-md ring-2 ring-slate-950"
              >
                <Sparkles className="w-3 h-3 fill-slate-950" />
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
                <PlatformIcon platform={app.platform} />
                {app.platform}
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {app.category}
              </span>
            </div>

            <h3 className="text-base font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">
              {app.title}
            </h3>

            <p className="text-xs text-slate-400 truncate">
              by <span className="text-slate-300">{app.developer || 'Creator'}</span>
            </p>
          </div>
        </div>

        {/* Short Tagline / Description */}
        <p className="mt-3.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
          {app.tagline || app.description?.slice(0, 100) || 'No description provided.'}
        </p>
      </div>

      {/* Card Footer: Metrics & Download Button */}
      <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1 text-amber-400 font-medium">
            <Star className="w-3.5 h-3.5 fill-amber-400" />
            <span>{app.rating ? app.rating.toFixed(1) : '5.0'}</span>
          </div>
          {app.version && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 text-[11px]">v{app.version}</span>
            </>
          )}
          {app.file_size && (
            <>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="text-slate-400 text-[11px] hidden sm:inline">{app.file_size}</span>
            </>
          )}
        </div>

        {/* Quick Download Button */}
        <button
          onClick={handleDownload}
          title={`Download ${app.title} (${app.version})`}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/90 hover:bg-indigo-500 text-white shadow-sm hover:shadow-indigo-500/25 transition-all group-hover:bg-indigo-600 active:scale-95"
        >
          {app.is_external_link ? (
            <>
              <ExternalLink className="w-3 h-3" />
              <span>Get</span>
            </>
          ) : (
            <>
              <Download className="w-3 h-3" />
              <span>Download</span>
            </>
          )}
        </button>
      </div>
    </Link>
  );
}
