import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Upload, 
  Image as ImageIcon, 
  FileBox, 
  Check, 
  Plus, 
  Trash2, 
  Sparkles, 
  Globe, 
  ShieldAlert, 
  CheckCircle2, 
  Loader2,
  X,
  Cloud,
  AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';

export default function AdminAppFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  // Form states
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Utilities');
  const [platform, setPlatform] = useState('Windows');
  const [version, setVersion] = useState('1.0.0');
  const [developer, setDeveloper] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isExternalLink, setIsExternalLink] = useState(false);
  const [externalDownloadUrl, setExternalDownloadUrl] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [systemRequirements, setSystemRequirements] = useState('');
  const [changelog, setChangelog] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [status, setStatus] = useState('published');

  // Dynamic Features List
  const [featuresList, setFeaturesList] = useState(['']);

  // File Upload states
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState('');
  const [appFile, setAppFile] = useState(null);
  const [existingFileName, setExistingFileName] = useState('');
  
  // Screenshots
  const [existingScreenshots, setExistingScreenshots] = useState([]);
  const [screenshotFiles, setScreenshotFiles] = useState([]);
  const [screenshotPreviews, setScreenshotPreviews] = useState([]);

  // UI status
  const [driveConfigured, setDriveConfigured] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Check Google Drive connection
  useEffect(() => {
    api.getDriveStatus()
      .then(res => setDriveConfigured(Boolean(res.configured)))
      .catch(() => {});
  }, []);

  // Auto-slugify when title changes in creation mode
  const handleTitleChange = (e) => {
    const val = e.target.value;
    setTitle(val);
    if (!isEditing && (!slug || slug === val.slice(0, -1).toLowerCase().replace(/\s+/g, '-'))) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
    }
  };

  // Load existing app if editing
  useEffect(() => {
    if (!isEditing) return;

    async function loadApp() {
      try {
        const app = await api.getAdminAppById(id);
        setTitle(app.title || '');
        setSlug(app.slug || '');
        setTagline(app.tagline || '');
        setDescription(app.description || '');
        setCategory(app.category || 'Utilities');
        setPlatform(app.platform || 'Windows');
        setVersion(app.version || '1.0.0');
        setDeveloper(app.developer || '');
        setWebsiteUrl(app.website_url || '');
        setIsExternalLink(Boolean(app.is_external_link));
        setExternalDownloadUrl(app.external_download_url || '');
        setFileSize(app.file_size || '');
        setSystemRequirements(app.system_requirements || '');
        setChangelog(app.changelog || '');
        setIsFeatured(Boolean(app.is_featured));
        setStatus(app.status || 'published');

        if (app.icon_url) {
          setIconPreview(app.icon_url);
        }

        if (app.file_name) {
          setExistingFileName(app.file_name);
        }

        if (app.screenshots) {
          setExistingScreenshots(Array.isArray(app.screenshots) ? app.screenshots : []);
        }

        if (app.features && Array.isArray(app.features) && app.features.length > 0) {
          setFeaturesList(app.features);
        }
      } catch (err) {
        setError('Failed to load application details: ' + err.message);
      } finally {
        setLoadingInitial(false);
      }
    }

    loadApp();
  }, [id, isEditing]);

  // Handle Icon selection
  const handleIconChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setIconFile(file);
      setIconPreview(URL.createObjectURL(file));
    }
  };

  // Handle App package binary selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAppFile(file);
      // Auto calculate friendly file size
      const bytes = file.size;
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      setFileSize((bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i]);
    }
  };

  // Handle Screenshots selection
  const handleScreenshotsChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setScreenshotFiles(prev => [...prev, ...files]);
      const newPreviews = files.map(f => URL.createObjectURL(f));
      setScreenshotPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  // Remove existing screenshot
  const removeExistingScreenshot = (index) => {
    setExistingScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  // Remove new pending screenshot
  const removeNewScreenshot = (index) => {
    setScreenshotFiles(prev => prev.filter((_, i) => i !== index));
    setScreenshotPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Features list helpers
  const handleFeatureChange = (index, value) => {
    setFeaturesList(prev => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  const addFeatureItem = () => {
    setFeaturesList(prev => [...prev, '']);
  };

  const removeFeatureItem = (index) => {
    setFeaturesList(prev => prev.filter((_, i) => i !== index));
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('App title is required.');
      return;
    }

    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('slug', slug.trim());
      formData.append('tagline', tagline.trim());
      formData.append('description', description.trim());
      formData.append('category', category);
      formData.append('platform', platform);
      formData.append('version', version.trim());
      formData.append('developer', developer.trim());
      formData.append('website_url', websiteUrl.trim());
      formData.append('is_external_link', isExternalLink ? '1' : '0');
      formData.append('external_download_url', externalDownloadUrl.trim());
      formData.append('file_size', fileSize.trim());
      formData.append('system_requirements', systemRequirements.trim());
      formData.append('changelog', changelog.trim());
      formData.append('is_featured', isFeatured ? '1' : '0');
      formData.append('status', status);

      // Clean non-empty features
      const filteredFeatures = featuresList.map(f => f.trim()).filter(Boolean);
      formData.append('features', JSON.stringify(filteredFeatures));

      // Append files
      if (iconFile) {
        formData.append('icon', iconFile);
      }
      if (appFile) {
        formData.append('file', appFile);
      }
      if (screenshotFiles.length > 0) {
        screenshotFiles.forEach(file => {
          formData.append('screenshots', file);
        });
      }

      if (isEditing) {
        formData.append('existing_screenshots', JSON.stringify(existingScreenshots));
        await api.updateApp(id, formData);
        setSuccess('Application updated successfully!');
      } else {
        await api.createApp(formData);
        setSuccess('Application published successfully!');
      }

      setTimeout(() => {
        navigate('/admin');
      }, 1000);
    } catch (err) {
      setError(err.message || 'Failed to save application');
    } finally {
      setSubmitting(false);
    }
  };

  const categories = [
    'Productivity',
    'Utilities',
    'Developer Tools',
    'Multimedia',
    'Security',
    'Games',
    'Communication',
    'Education',
    'Finance',
    'Design'
  ];

  const platforms = [
    'Windows',
    'Android',
    'Cross-Platform',
    'macOS',
    'Linux',
    'Web / PWA'
  ];

  if (loadingInitial) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-slate-400 text-sm">Loading app details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            to="/admin"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              {isEditing ? `Edit "${title || 'App'}"` : 'Upload & Publish New Application'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Fill in the metadata, upload installers, add screenshots, and describe your creation.
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
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

      <form onSubmit={handleSubmit} className="space-y-8 text-xs">
        {/* Section 1: Basic Identity & Core Info */}
        <div className="rounded-3xl bg-slate-900/70 border border-slate-800 p-6 sm:p-8 space-y-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-xs">1</span>
            Basic Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                App Title <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={handleTitleChange}
                placeholder="e.g. FastFlow Task Manager"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                URL Slug (identifier)
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="fastflow-task-manager"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">
              Tagline / Catchphrase (Short summary)
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Keyboard-driven task tracking with instant local search."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 outline-none"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Target Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 outline-none"
              >
                {platforms.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Version
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono placeholder-slate-600 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Developer / Studio Name
              </label>
              <input
                type="text"
                value={developer}
                onChange={(e) => setDeveloper(e.target.value)}
                placeholder="e.g. Apex Studio"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Website / GitHub Repository
              </label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://github.com/..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Google Drive Storage & Downloads */}
        <div className="rounded-3xl bg-slate-900/70 border border-slate-800 p-6 sm:p-8 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-600/30 text-emerald-400 flex items-center justify-center text-xs">2</span>
              Google Drive Cloud Storage
            </h2>

            {driveConfigured ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                Google Drive Storage Connected
              </span>
            ) : (
              <Link
                to="/admin/settings"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Connect Google Drive in Settings
              </Link>
            )}
          </div>

          <div className="flex items-center gap-4 bg-slate-950 p-2 rounded-2xl border border-slate-800 max-w-md">
            <button
              type="button"
              onClick={() => setIsExternalLink(false)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                !isExternalLink ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Upload to Google Drive
            </button>
            <button
              type="button"
              onClick={() => setIsExternalLink(true)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                isExternalLink ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              External Mirror URL
            </button>
          </div>

          {!isExternalLink ? (
            <div className="space-y-4">
              <label className="block text-slate-300 font-medium">
                Upload Application Package (.apk, .exe, .msi, .zip, .dmg, etc.)
              </label>
              
              <div className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 text-center transition-colors bg-slate-950/40 relative">
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Cloud className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-slate-200 font-medium">
                  {appFile ? appFile.name : (existingFileName ? `Current file: ${existingFileName}` : 'Choose or drop installer package to upload to Google Drive')}
                </p>
                <p className="text-slate-500 text-[11px] mt-1">
                  Files are uploaded directly to your Google Drive and automatically deleted from Drive if removed.
                </p>
                {fileSize && (
                  <p className="text-emerald-400 font-mono text-[11px] mt-2">
                    Size: {fileSize}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-slate-300 font-medium">
                External Download Link (GitHub Release, Google Drive shared link, etc.)
              </label>
              <input
                type="url"
                value={externalDownloadUrl}
                onChange={(e) => setExternalDownloadUrl(e.target.value)}
                placeholder="https://drive.google.com/... or https://github.com/..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:border-emerald-500 outline-none"
              />

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Manual File Size (Optional)
                </label>
                <input
                  type="text"
                  value={fileSize}
                  onChange={(e) => setFileSize(e.target.value)}
                  placeholder="e.g. 45.2 MB"
                  className="w-48 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Visual Media (Icon & Screenshots) */}
        <div className="rounded-3xl bg-slate-900/70 border border-slate-800 p-6 sm:p-8 space-y-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-xs">3</span>
            Visual Assets
          </h2>

          {/* App Icon Upload */}
          <div className="space-y-3">
            <label className="block text-slate-300 font-medium">
              Application Icon (Square PNG, JPG, or SVG)
            </label>

            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl border border-slate-700 bg-slate-950 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-md">
                {iconPreview ? (
                  <img src={iconPreview} alt="App Icon" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-600" />
                )}
              </div>

              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleIconChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
                >
                  Choose New Icon
                </button>
                <p className="text-[11px] text-slate-500 mt-1">Recommended: 512x512 PNG</p>
              </div>
            </div>
          </div>

          {/* Screenshots Upload */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="block text-slate-300 font-medium">
                Screenshots & UI Previews
              </label>
              <div className="relative">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleScreenshotsChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Screenshot Images
                </button>
              </div>
            </div>

            {/* Screenshots Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Existing Screenshots */}
              {existingScreenshots.map((url, idx) => (
                <div key={`existing-${idx}`} className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeExistingScreenshot(idx)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-md bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove screenshot"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Newly Selected Screenshot Previews */}
              {screenshotPreviews.map((url, idx) => (
                <div key={`new-${idx}`} className="relative group rounded-xl overflow-hidden border border-indigo-500/40 bg-slate-950 aspect-video">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[9px] font-bold">New</span>
                  <button
                    type="button"
                    onClick={() => removeNewScreenshot(idx)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-md bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove screenshot"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {existingScreenshots.length === 0 && screenshotPreviews.length === 0 && (
                <div className="col-span-full py-8 text-center border border-dashed border-slate-800 rounded-2xl text-slate-500">
                  No screenshots uploaded yet. Add screenshots to give users a look at your app's interface!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 4: Detailed Descriptions & Content */}
        <div className="rounded-3xl bg-slate-900/70 border border-slate-800 p-6 sm:p-8 space-y-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-xs">4</span>
            Descriptions & Specifications
          </h2>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">
              Full Description (Supports Markdown: headers, bold text, bullet points)
            </label>
            <textarea
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of what the app does, how to use it, why you built it..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500 outline-none leading-relaxed"
            />
          </div>

          {/* Dynamic Key Features */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-slate-300 font-medium">
                Key Features Checklist
              </label>
              <button
                type="button"
                onClick={addFeatureItem}
                className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium"
              >
                <Plus className="w-3 h-3" /> Add Feature Point
              </button>
            </div>

            <div className="space-y-2">
              {featuresList.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => handleFeatureChange(idx, e.target.value)}
                    placeholder={`Feature #${idx + 1}, e.g. Zero-lag keyboard shortcuts`}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500 outline-none"
                  />
                  {featuresList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFeatureItem(idx)}
                      className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                System Requirements
              </label>
              <textarea
                rows={3}
                value={systemRequirements}
                onChange={(e) => setSystemRequirements(e.target.value)}
                placeholder="Windows 10/11 64-bit, 4GB RAM, 100MB free space"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Changelog / What's New
              </label>
              <textarea
                rows={3}
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                placeholder="- New dark mode&#10;- Improved rendering performance by 25%"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500 outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Publishing & Visibility */}
        <div className="rounded-3xl bg-slate-900/70 border border-slate-800 p-6 sm:p-8 space-y-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-xs">5</span>
            Publishing Status & Visibility
          </h2>

          <div className="flex flex-col sm:flex-row gap-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700 focus:ring-indigo-500"
              />
              <div>
                <span className="font-semibold text-white">Feature in Homepage Spotlight</span>
                <p className="text-slate-400 text-[11px]">Display this app in the top hero spotlight banner.</p>
              </div>
            </label>

            <div className="flex items-center gap-3">
              <span className="text-slate-300 font-medium">Release Status:</span>
              <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setStatus('published')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    status === 'published' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Published (Live)
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('draft')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    status === 'draft' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Draft (Hidden)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <Link
            to="/admin"
            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-95"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Application...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{isEditing ? 'Save Changes' : 'Publish Application'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
