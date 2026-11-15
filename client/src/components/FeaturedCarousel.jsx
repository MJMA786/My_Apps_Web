import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Download, Sparkles, ChevronLeft, ChevronRight, Star, ShieldCheck } from 'lucide-react';
import { PlatformIcon } from './AppCard';
import { api } from '../services/api';

export default function FeaturedCarousel({ featuredApps = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (featuredApps.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredApps.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [featuredApps.length]);

  if (!featuredApps || featuredApps.length === 0) return null;

  const currentApp = featuredApps[currentIndex];

  const handlePrev = (e) => {
    e.preventDefault();
    setCurrentIndex((prev) => (prev === 0 ? featuredApps.length - 1 : prev - 1));
  };

  const handleNext = (e) => {
    e.preventDefault();
    setCurrentIndex((prev) => (prev + 1) % featuredApps.length);
  };

  return (
    <div className="relative w-full rounded-3xl overflow-hidden border border-slate-800 bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900 shadow-2xl">
      {/* Background ambient glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent pointer-events-none" />

      <div className="relative z-10 p-6 sm:p-10 flex flex-col lg:flex-row items-center justify-between gap-8">
        {/* Left: App details */}
        <div className="flex-1 space-y-4 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Featured Spotlight</span>
          </div>

          <div className="flex items-center gap-4 justify-center lg:justify-start">
            {currentApp.icon_url && (
              <img
                src={currentApp.icon_url}
                alt={currentApp.title}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shadow-xl border border-slate-700/60 bg-slate-800"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/demo-icons/default.png';
                }}
              />
            )}
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {currentApp.title}
              </h2>
              <div className="flex items-center gap-2 mt-1 justify-center lg:justify-start text-xs text-slate-300">
                <span className="flex items-center gap-1 font-medium text-amber-400">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  {currentApp.rating ? currentApp.rating.toFixed(1) : '5.0'}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <PlatformIcon platform={currentApp.platform} />
                  {currentApp.platform}
                </span>
                <span>•</span>
                <span className="text-indigo-400">{currentApp.category}</span>
                <span>•</span>
                <span className="text-slate-400">v{currentApp.version}</span>
              </div>
            </div>
          </div>

          <p className="text-slate-300 text-sm sm:text-base max-w-xl line-clamp-3 leading-relaxed">
            {currentApp.tagline || currentApp.description}
          </p>

          <div className="flex flex-wrap items-center gap-3 justify-center lg:justify-start pt-2">
            <a
              href={api.getDownloadUrl(currentApp.slug)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Download Now {currentApp.file_size ? `(${currentApp.file_size})` : ''}</span>
            </a>

            <Link
              to={`/apps/${currentApp.slug}`}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 font-medium text-sm border border-slate-700/70 transition-colors"
            >
              Learn More & Screenshots
            </Link>

            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium pl-1">
              <ShieldCheck className="w-4 h-4" /> Clean & Verified
            </span>
          </div>
        </div>

        {/* Right: Screenshot preview or Mockup */}
        {currentApp.screenshots && currentApp.screenshots.length > 0 && (
          <div className="w-full lg:w-1/2 max-w-md relative group">
            <div className="relative rounded-2xl overflow-hidden border border-slate-700/70 shadow-2xl bg-slate-950 aspect-video">
              <img
                src={currentApp.screenshots[0]}
                alt={currentApp.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
            </div>
          </div>
        )}
      </div>

      {/* Navigation arrows & dots if multiple featured apps */}
      {featuredApps.length > 1 && (
        <div className="flex items-center justify-between px-6 py-3 bg-slate-950/60 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5">
            {featuredApps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentIndex ? 'w-6 bg-indigo-500' : 'w-2 bg-slate-700 hover:bg-slate-600'
                }`}
                title={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
