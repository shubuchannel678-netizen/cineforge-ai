import React, { useState, useEffect } from 'react';
import { Palette, Camera, Sun, Ban, Save, Sparkles } from 'lucide-react';
import type { StyleBible } from '../../shared/types/index';

interface StyleBibleManagerProps {
  styleBible: StyleBible | null;
  onSaveStyle: (data: any) => void;
}

export const StyleBibleManager: React.FC<StyleBibleManagerProps> = ({
  styleBible,
  onSaveStyle,
}) => {
  const [styleName, setStyleName] = useState('');
  const [lighting, setLighting] = useState('');
  const [cameraGear, setCameraGear] = useState('');
  const [paletteStr, setPaletteStr] = useState('');
  const [envRules, setEnvRules] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');

  useEffect(() => {
    if (styleBible) {
      setStyleName(styleBible.style_name || '');
      setLighting(styleBible.lighting || '');
      setCameraGear(styleBible.camera_gear || '');
      setPaletteStr((styleBible.color_palette || []).join(', '));
      setEnvRules(styleBible.environment_rules || '');
      setNegativePrompt(styleBible.negative_prompt || '');
    }
  }, [styleBible]);

  const handleSave = () => {
    const palette = paletteStr.split(',').map((s) => s.trim()).filter(Boolean);
    onSaveStyle({
      styleName,
      lighting,
      cameraGear,
      colorPalette: palette,
      environmentRules: envRules,
      negativePrompt,
    });
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Camera className="w-4 h-4 text-indigo-400" />
            <span>Universal Style Bible</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Global cinematography, lens geometry, and lighting directives injected into all shot prompts.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300">Style Name</label>
          <input
            type="text"
            value={styleName}
            onChange={(e) => setStyleName(e.target.value)}
            className="w-full p-2.5 rounded-xl glass-input text-xs text-slate-200"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300">Camera & Lens Specifications</label>
          <input
            type="text"
            value={cameraGear}
            onChange={(e) => setCameraGear(e.target.value)}
            placeholder="e.g. ARRI Alexa LF, 35mm Anamorphic Master Prime"
            className="w-full p-2.5 rounded-xl glass-input text-xs text-slate-200"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300">Lighting Temperature & Setup</label>
          <input
            type="text"
            value={lighting}
            onChange={(e) => setLighting(e.target.value)}
            placeholder="e.g. Rembrandt lighting, golden hour volumetric haze"
            className="w-full p-2.5 rounded-xl glass-input text-xs text-slate-200"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300">Color Palette Hex Codes (Comma separated)</label>
          <input
            type="text"
            value={paletteStr}
            onChange={(e) => setPaletteStr(e.target.value)}
            placeholder="#6366f1, #0ea5e9, #f59e0b, #0f172a"
            className="w-full p-2.5 rounded-xl glass-input text-xs text-slate-200 font-mono"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-300">Environment & World Consistency Rules</label>
        <textarea
          value={envRules}
          onChange={(e) => setEnvRules(e.target.value)}
          rows={2}
          placeholder="e.g. Pristine photographic texture continuity, hyper-detailed backgrounds without blur anomalies"
          className="w-full p-2.5 rounded-xl glass-input text-xs text-slate-200"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Ban className="w-3.5 h-3.5 text-rose-400" />
          <span>Global Negative Prompt (Disallowed Artifacts)</span>
        </label>
        <textarea
          value={negativePrompt}
          onChange={(e) => setNegativePrompt(e.target.value)}
          rows={2}
          className="w-full p-2.5 rounded-xl glass-input text-xs text-slate-200 font-mono"
        />
      </div>

      <div className="pt-2 flex justify-end">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
        >
          <Save className="w-4 h-4" />
          <span>Save Style Bible</span>
        </button>
      </div>
    </div>
  );
};
