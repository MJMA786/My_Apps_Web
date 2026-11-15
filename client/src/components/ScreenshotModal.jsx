import React, { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ScreenshotModal({ screenshots = [], selectedIndex, onClose, onSelectIndex }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') {
        onSelectIndex((selectedIndex - 1 + screenshots.length) % screenshots.length);
      }
      if (e.key === 'ArrowRight') {
        onSelectIndex((selectedIndex + 1) % screenshots.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, screenshots.length, onClose, onSelectIndex]);

  if (selectedIndex === null || !screenshots[selectedIndex]) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white transition-colors z-50"
        title="Close preview (Esc)"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Prev button */}
      {screenshots.length > 1 && (
        <button
          onClick={() => onSelectIndex((selectedIndex - 1 + screenshots.length) % screenshots.length)}
          className="absolute left-4 p-3 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white transition-colors z-50"
          title="Previous screenshot (Left arrow)"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Image container */}
      <div className="max-w-5xl max-h-[85vh] flex flex-col items-center justify-center">
        <img
          src={screenshots[selectedIndex]}
          alt={`Screenshot ${selectedIndex + 1}`}
          className="max-h-[80vh] w-auto object-contain rounded-xl shadow-2xl border border-slate-800"
        />
        <div className="mt-3 text-slate-400 text-xs font-medium">
          Screenshot {selectedIndex + 1} of {screenshots.length}
        </div>
      </div>

      {/* Next button */}
      {screenshots.length > 1 && (
        <button
          onClick={() => onSelectIndex((selectedIndex + 1) % screenshots.length)}
          className="absolute right-4 p-3 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white transition-colors z-50"
          title="Next screenshot (Right arrow)"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
