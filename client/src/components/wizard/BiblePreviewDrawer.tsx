import React from 'react';
import { User, Camera, Shield, Palette, Sparkles } from 'lucide-react';

interface BiblePreviewDrawerProps {
  visualStyle: string;
  pacing: string;
  aspectRatio: string;
}

export const BiblePreviewDrawer: React.FC<BiblePreviewDrawerProps> = ({
  visualStyle,
  pacing,
  aspectRatio,
}) => {
  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Continuity Bible Guardrails
          </h4>
        </div>
        <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Automated Invariant Extraction
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Style Guardrail */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-indigo-300 font-semibold">
            <Camera className="w-4 h-4" />
            <span>Camera & Lighting Bible</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Universal camera lenses, lighting temperature, and negative prompt rules will be injected into every individual shot to eliminate visual hallucinations.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
              Style: {visualStyle}
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
              Format: {aspectRatio}
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
              Pacing: {pacing}
            </span>
          </div>
        </div>

        {/* Character Guardrail */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-violet-300 font-semibold">
            <User className="w-4 h-4" />
            <span>Character Invariant Anchors</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Gemini 2.5 extracts hair, clothing colors, and distinguishing equipment anchors. If your characters appear in Scene 1 and Scene 14, their visual traits will remain continuous.
          </p>
          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-500 font-mono">
            <span>• Invariant Outfits</span>
            <span>• Facial Geometry</span>
            <span>• LORE Props</span>
          </div>
        </div>
      </div>
    </div>
  );
};
