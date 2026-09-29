import React from 'react';
import { Palette, Check, Sparkles } from 'lucide-react';

interface StylePresetPickerProps {
  value: string;
  onChange: (val: string) => void;
}

export const StylePresetPicker: React.FC<StylePresetPickerProps> = ({ value, onChange }) => {
  const styles = [
    {
      id: 'Cinematic Realism',
      title: 'Cinematic Realism',
      tag: 'Hollywood Master',
      description: '35mm anamorphic lenses, natural golden hour lighting, subtle film grain, shallow depth of field.',
      gradient: 'from-amber-600/30 via-slate-900 to-slate-950',
      accentColor: '#f59e0b',
    },
    {
      id: 'Minecraft Lore',
      title: 'Minecraft Lore',
      tag: 'Gaming Cinema',
      description: 'Atmospheric voxel world, volumetric torchlight rays, deep cavern fog, blocky survival aesthetics.',
      gradient: 'from-emerald-600/30 via-slate-900 to-slate-950',
      accentColor: '#10b981',
    },
    {
      id: 'Anime / Studio Ghibli',
      title: 'Anime / Studio Ghibli',
      tag: 'Animation',
      description: 'Hand-painted watercolor backgrounds, lush rolling clouds, rich emotive colors, cel-shaded character focus.',
      gradient: 'from-sky-600/30 via-slate-900 to-slate-950',
      accentColor: '#0ea5e9',
    },
    {
      id: 'Cyberpunk Neo-Noir',
      title: 'Cyberpunk Neo-Noir',
      tag: 'Sci-Fi Lore',
      description: 'Wet asphalt reflections, neon cyan and magenta rim lighting, towering mega-structures, holographic haze.',
      gradient: 'from-fuchsia-600/30 via-slate-900 to-slate-950',
      accentColor: '#d946ef',
    },
    {
      id: 'Retro 80s VHS',
      title: 'Retro 80s VHS',
      tag: 'Vintage Analog',
      description: 'Warm analog chromatic aberration, magnetic tape tracking lines, saturated neon sunset tones.',
      gradient: 'from-rose-600/30 via-slate-900 to-slate-950',
      accentColor: '#f43f5e',
    },
    {
      id: '3D Pixar-Style',
      title: '3D Animated Feature',
      tag: 'Stylized 3D',
      description: 'Soft subsurface scattering, rounded expressive shapes, vibrant storybook lighting, family entertainment.',
      gradient: 'from-indigo-600/30 via-slate-900 to-slate-950',
      accentColor: '#6366f1',
    },
    {
      id: 'Documentary Archival',
      title: 'Documentary Archival',
      tag: 'Educational & History',
      description: 'Authoritative composition, authentic monochrome or vintage film preservation textures, historical gravitas.',
      gradient: 'from-stone-600/30 via-slate-900 to-slate-950',
      accentColor: '#a8a29e',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
          Visual Style Preset
        </label>
        <span className="text-xs text-indigo-400 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5" />
          Injected into every shot prompt
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {styles.map((style) => {
          const isSelected = value === style.id;
          return (
            <div
              key={style.id}
              onClick={() => onChange(style.id)}
              className={`relative cursor-pointer rounded-2xl p-4 border transition-all duration-200 overflow-hidden bg-gradient-to-br ${style.gradient} ${
                isSelected
                  ? 'border-indigo-500 ring-2 ring-indigo-500/50 shadow-lg shadow-indigo-500/20'
                  : 'border-slate-800/80 hover:border-slate-700 hover:scale-[1.01]'
              }`}
            >
              {/* Selected Check Icon */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}

              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase"
                  style={{
                    backgroundColor: `${style.accentColor}20`,
                    color: style.accentColor,
                    borderColor: `${style.accentColor}40`,
                    borderWidth: '1px',
                  }}
                >
                  {style.tag}
                </span>
              </div>

              <h4 className="font-bold text-sm text-white mb-1">{style.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                {style.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
