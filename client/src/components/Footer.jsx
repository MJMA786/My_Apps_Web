import React from 'react';
import { Link } from 'react-router-dom';
import { Boxes, Shield, Download, Sparkles, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 mt-20 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <Boxes className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold text-white">
                MyApps<span className="text-indigo-400">.hub</span>
              </span>
            </div>
            <p className="text-slate-400 max-w-sm text-sm leading-relaxed">
              A streamlined, self-hosted distribution platform for apps and tools. 
              Upload APKs, Windows executables, Mac and Linux binaries with instant direct downloads.
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-400 pt-2">
              <span className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-400" />
                Verified & Malware-Scanned
              </span>
              <span className="flex items-center gap-1.5">
                <Download className="w-4 h-4 text-indigo-400" />
                High-Speed Direct Mirror
              </span>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Explore</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="hover:text-indigo-400 transition-colors">
                  Featured Applications
                </Link>
              </li>
              <li>
                <Link to="/apps" className="hover:text-indigo-400 transition-colors">
                  All Apps Catalog
                </Link>
              </li>
              <li>
                <Link to="/apps?platform=Windows" className="hover:text-indigo-400 transition-colors">
                  Windows Software
                </Link>
              </li>
              <li>
                <Link to="/apps?platform=Android" className="hover:text-indigo-400 transition-colors">
                  Android APK Packages
                </Link>
              </li>
            </ul>
          </div>

          {/* Management / Admin */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Administration</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/admin/login" className="hover:text-indigo-400 transition-colors">
                  Admin Login
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-indigo-400 transition-colors">
                  Management Dashboard
                </Link>
              </li>
              <li>
                <Link to="/admin/apps/new" className="hover:text-indigo-400 transition-colors">
                  Publish New App
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800/80 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© {new Date().getFullYear()} MyApps Distribution Platform. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Built for creators & developers <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
          </p>
        </div>
      </div>
    </footer>
  );
}
