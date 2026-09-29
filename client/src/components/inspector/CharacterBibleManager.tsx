import React, { useState } from 'react';
import { User, Plus, Trash2, Save, Sparkles, Image as ImageIcon } from 'lucide-react';
import type { CharacterBible } from '../../shared/types/index';

interface CharacterBibleManagerProps {
  characterBibles: CharacterBible[];
  onSaveCharacter: (charId: string, data: any) => void;
}

export const CharacterBibleManager: React.FC<CharacterBibleManagerProps> = ({
  characterBibles,
  onSaveCharacter,
}) => {
  const [selectedChar, setSelectedChar] = useState<CharacterBible | null>(characterBibles[0] || null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hair, setHair] = useState('');
  const [clothing, setClothing] = useState('');
  const [build, setBuild] = useState('');
  const [features, setFeatures] = useState('');

  React.useEffect(() => {
    if (selectedChar) {
      setName(selectedChar.name);
      setDescription(selectedChar.description);
      setHair(selectedChar.visual_attributes?.hair || '');
      setClothing(selectedChar.visual_attributes?.clothing || '');
      setBuild(selectedChar.visual_attributes?.build || '');
      setFeatures(selectedChar.visual_attributes?.distinguishingFeatures || '');
    }
  }, [selectedChar]);

  const handleSave = () => {
    if (!selectedChar) return;
    onSaveCharacter(selectedChar.id, {
      name,
      description,
      visualAttributes: {
        hair,
        clothing,
        build,
        distinguishingFeatures: features,
      },
    });
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-400" />
            <span>Character Continuity Bibles</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Invariant visual anchors enforced across all downstream scenes and shots.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Character List Sidebar */}
        <div className="space-y-2">
          {characterBibles.map((char) => {
            const isSelected = selectedChar?.id === char.id;
            return (
              <div
                key={char.id}
                onClick={() => setSelectedChar(char)}
                className={`p-3 rounded-xl cursor-pointer border transition-all ${
                  isSelected
                    ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-sm">{char.name}</div>
                <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{char.description}</div>
              </div>
            );
          })}
        </div>

        {/* Selected Character Editor */}
        {selectedChar && (
          <div className="md:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Character Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 rounded-xl glass-input text-xs text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Physical Build</label>
                <input
                  type="text"
                  value={build}
                  onChange={(e) => setBuild(e.target.value)}
                  placeholder="e.g. Athletic, tall, determined posture"
                  className="w-full p-2.5 rounded-xl glass-input text-xs text-slate-200"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Core Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full p-2.5 rounded-xl glass-input text-xs text-slate-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Hair & Head Attributes</label>
                <input
                  type="text"
                  value={hair}
                  onChange={(e) => setHair(e.target.value)}
                  placeholder="e.g. Blocky dark hair, windswept"
                  className="w-full p-2.5 rounded-xl glass-input text-xs text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Invariant Wardrobe / Clothing</label>
                <input
                  type="text"
                  value={clothing}
                  onChange={(e) => setClothing(e.target.value)}
                  placeholder="e.g. Cyan tunic, charcoal utility trousers"
                  className="w-full p-2.5 rounded-xl glass-input text-xs text-slate-200"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Distinguishing Features & Props</label>
              <input
                type="text"
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                placeholder="e.g. Weathered compass, enchanted pickaxe holster"
                className="w-full p-2.5 rounded-xl glass-input text-xs text-slate-200"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>Save Character Bible</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
