import React, { useState, useEffect } from 'react';
import { ParadeState, TerrainType } from '../types';
import { getSavedParades } from '../services/storageService';
import { Map, Plus, Save, LayoutGrid } from 'lucide-react';

interface MainMenuProps {
  onStart: (state: ParadeState) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onStart }) => {
  const [saves, setSaves] = useState<ParadeState[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // New Parade Form State
  const [title, setTitle] = useState('New Parade');
  const [width, setWidth] = useState(50);
  const [height, setHeight] = useState(40);
  const [terrain, setTerrain] = useState<TerrainType>('ASPHALT');

  useEffect(() => {
    setSaves(getSavedParades());
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const newParade: ParadeState = {
      config: {
        id: crypto.randomUUID(),
        title,
        width,
        height,
        terrain,
        lastModified: Date.now()
      },
      entities: [],
      groups: {},
      animation: {
        duration: 60,
        tracks: {}
      }
    };
    onStart(newParade);
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleString();

  if (isCreating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-8">
        <div className="w-full max-w-md bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Plus className="w-6 h-6 text-green-500" /> Create New Parade
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Parade Title</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-green-500 outline-none"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Width (Paces)</label>
                <input 
                  type="number" 
                  min="10" max="200"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Height (Paces)</label>
                <input 
                  type="number" 
                  min="10" max="200"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Terrain</label>
              <div className="grid grid-cols-3 gap-2">
                {(['ASPHALT', 'GRASS', 'SAND'] as TerrainType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTerrain(t)}
                    className={`py-2 rounded border ${terrain === t ? 'border-green-500 bg-green-900/30 text-green-400' : 'border-gray-600 bg-gray-700 text-gray-400'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                type="button" 
                onClick={() => setIsCreating(false)}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded text-white font-medium"
              >
                Initialize Ground
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white p-8 font-sans">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-wider uppercase mb-2 text-gray-100">Parade Ground Sim</h1>
        <p className="text-gray-400">St John Brigade Singapore • Spatial Planning Tool</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
        {/* New Parade Card */}
        <button 
          onClick={() => setIsCreating(true)}
          className="flex flex-col items-center justify-center h-64 bg-gray-900 border-2 border-dashed border-gray-700 rounded-xl hover:border-green-500 hover:bg-gray-800 transition-all group"
        >
          <div className="p-4 rounded-full bg-gray-800 group-hover:bg-green-900/50 mb-4 transition-colors">
            <Plus className="w-8 h-8 text-green-500" />
          </div>
          <span className="text-xl font-medium">New Parade Plan</span>
          <span className="text-sm text-gray-500 mt-2">Define dimensions & terrain</span>
        </button>

        {/* Saved Slots */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
            <Save className="w-5 h-5" /> Recent Plans
          </h3>
          {saves.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-600 italic bg-gray-900 rounded-xl border border-gray-800 p-8">
              No saved parades found.
            </div>
          ) : (
            saves.map((save) => (
              <button
                key={save.config.id}
                onClick={() => onStart(save)}
                className="w-full text-left p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-500 hover:bg-gray-800 transition-all flex justify-between items-center group"
              >
                <div>
                  <h4 className="font-bold text-gray-200 group-hover:text-blue-400">{save.config.title}</h4>
                  <div className="text-xs text-gray-500 mt-1 flex gap-3">
                    <span className="flex items-center gap-1"><LayoutGrid className="w-3 h-3" /> {save.config.width}x{save.config.height}</span>
                    <span className="capitalize">{save.config.terrain.toLowerCase()}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-600 block">Last Modified</span>
                  <span className="text-xs text-gray-400">{formatDate(save.config.lastModified)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};