
import React, { useState, useEffect } from 'react';
import { ParadeState, TerrainType } from '../types';
import { getSavedParades } from '../services/storageService';
import { Map, Plus, Save, LayoutGrid, Trash2 } from 'lucide-react';
import { TERRAIN_COLORS } from '../constants';

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

  const getTerrainLabel = (t: TerrainType) => {
      if (t === 'ASPHALT') return 'Road';
      if (t === 'GRASS') return 'Grass';
      if (t === 'SAND') return 'Sand';
      return t;
  };

  const renderTerrainPreview = (t: TerrainType) => {
      const color = TERRAIN_COLORS[t];
      return (
          <div className="w-full h-16 rounded mb-2 relative overflow-hidden border border-gray-600 shadow-inner" style={{ backgroundColor: color }}>
              {t === 'ASPHALT' && (
                  <div className="absolute inset-0" style={{ 
                      backgroundImage: 'radial-gradient(circle, transparent 20%, #222 20%, #222 80%, transparent 80%, transparent), radial-gradient(circle, transparent 20%, #222 20%, #222 80%, transparent 80%, transparent)',
                      backgroundSize: '10px 10px',
                      backgroundPosition: '0 0, 5px 5px',
                      opacity: 0.1
                  }}>
                      <div className="absolute top-1/2 left-0 w-full h-1 bg-white/30 border-t border-b border-transparent border-dashed" style={{borderTopWidth: 2}} />
                  </div>
              )}
              {t === 'SAND' && (
                   <div className="absolute inset-0 opacity-30" style={{ 
                       backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'6\' height=\'6\' viewBox=\'0 0 6 6\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.4\' fill-rule=\'evenodd\'%3E%3Cpath d=\'M5 0h1L0 6V5zM6 5v1H5z\'/%3E%3C/g%3E%3C/svg%3E")' 
                   }}></div>
              )}
              {t === 'GRASS' && (
                   <div className="absolute inset-0 opacity-20" style={{ 
                       backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)', 
                       backgroundSize: '20px 20px', 
                       backgroundPosition: '0 0, 10px 10px',
                       filter: 'contrast(1.5)'
                   }}></div>
              )}
          </div>
      );
  };

  if (isCreating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-yellow-500 p-8 font-sans">
        <div className="w-full max-w-lg bg-gray-900 p-8 rounded-xl shadow-2xl border border-yellow-600/30">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-yellow-400 uppercase tracking-widest border-b border-gray-800 pb-4">
            <Plus className="w-8 h-8" /> Initialize Ground
          </h2>
          <form onSubmit={handleCreate} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-yellow-600 uppercase mb-1 tracking-wider">Operation Title</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-3 text-gray-100 focus:border-yellow-500 outline-none transition-colors"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-yellow-600 uppercase mb-1 tracking-wider">Width (Paces)</label>
                <input 
                  type="number" 
                  min="10" max="200"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-3 text-gray-100 focus:border-yellow-500 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-yellow-600 uppercase mb-1 tracking-wider">Height (Paces)</label>
                <input 
                  type="number" 
                  min="10" max="200"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-3 text-gray-100 focus:border-yellow-500 outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-yellow-600 uppercase mb-3 tracking-wider">Terrain Type</label>
              <div className="grid grid-cols-3 gap-4">
                {(['ASPHALT', 'GRASS', 'SAND'] as TerrainType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTerrain(t)}
                    className={`relative p-1 rounded-lg border-2 transition-all ${terrain === t ? 'border-yellow-500 scale-105 shadow-lg shadow-yellow-900/20' : 'border-gray-700 opacity-60 hover:opacity-100'}`}
                  >
                    {renderTerrainPreview(t)}
                    <span className={`block text-center text-xs font-bold uppercase ${terrain === t ? 'text-yellow-400' : 'text-gray-500'}`}>
                        {getTerrainLabel(t)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4 mt-8 pt-4 border-t border-gray-800">
              <button 
                type="button" 
                onClick={() => setIsCreating(false)}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 font-bold uppercase tracking-wider text-sm transition-colors"
              >
                Abort
              </button>
              <button 
                type="submit" 
                className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 text-black rounded font-bold uppercase tracking-wider text-sm shadow-lg hover:shadow-yellow-500/20 transition-all"
              >
                Confirm
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-8 font-sans selection:bg-yellow-500/30">
      <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-5xl md:text-6xl font-black tracking-widest uppercase mb-4 text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-sm">
          SJBS Parade Simulator
        </h1>
        <div className="h-1 w-32 bg-yellow-600 mx-auto rounded-full"></div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 w-full max-w-5xl">
        {/* New Parade Card */}
        <button 
          onClick={() => setIsCreating(true)}
          className="flex flex-col items-center justify-center h-80 bg-gray-900/50 border border-gray-800 hover:border-yellow-500/50 rounded-2xl transition-all group hover:bg-gray-900 hover:shadow-2xl hover:shadow-yellow-900/10 backdrop-blur-sm relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="p-6 rounded-full bg-gray-800 border border-gray-700 group-hover:border-yellow-500 group-hover:bg-yellow-500 text-yellow-500 group-hover:text-black mb-6 transition-all duration-300 transform group-hover:scale-110 shadow-xl">
            <Plus className="w-10 h-10" />
          </div>
          <span className="text-2xl font-bold uppercase tracking-wider text-gray-300 group-hover:text-white transition-colors">New Operation</span>
          <span className="text-sm text-gray-500 mt-2 font-mono group-hover:text-yellow-500/70 transition-colors">INITIALIZE GRID & TERRAIN</span>
        </button>

        {/* Saved Slots */}
        <div className="flex flex-col h-80 bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="p-6 border-b border-gray-800 bg-gray-900/80">
             <h3 className="text-lg font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-3">
                <Save className="w-5 h-5" /> Recent Plans
             </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {saves.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 italic">
                    <span className="mb-2 opacity-50"><LayoutGrid className="w-12 h-12" /></span>
                    No saved plans found.
                </div>
            ) : (
                saves.map((save) => (
                <button
                    key={save.config.id}
                    onClick={() => onStart(save)}
                    className="w-full text-left p-4 bg-gray-800/50 border border-gray-700 rounded-xl hover:border-yellow-500/50 hover:bg-gray-800 transition-all flex justify-between items-center group relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-yellow-500/5 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300"></div>
                    <div className="relative z-10">
                        <h4 className="font-bold text-lg text-gray-200 group-hover:text-yellow-400 transition-colors">{save.config.title}</h4>
                        <div className="text-xs text-gray-500 mt-1 flex gap-4 font-mono">
                            <span className="flex items-center gap-1"><LayoutGrid className="w-3 h-3" /> {save.config.width}x{save.config.height}</span>
                            <span className="uppercase text-yellow-600/80">{getTerrainLabel(save.config.terrain)}</span>
                        </div>
                    </div>
                    <div className="text-right relative z-10">
                        <span className="text-[10px] text-gray-600 block uppercase tracking-wide">Last Modified</span>
                        <span className="text-xs text-gray-400 font-mono">{formatDate(save.config.lastModified)}</span>
                    </div>
                </button>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
