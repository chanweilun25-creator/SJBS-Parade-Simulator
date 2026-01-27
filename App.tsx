import React, { useState } from 'react';
import { MainMenu } from './components/MainMenu';
import { Simulator } from './components/Simulator';
import { ParadeState } from './types';

const App: React.FC = () => {
  const [activeParade, setActiveParade] = useState<ParadeState | null>(null);

  return (
    <div className="text-gray-100 antialiased">
      {!activeParade ? (
        <MainMenu onStart={setActiveParade} />
      ) : (
        <Simulator 
          initialState={activeParade} 
          onExit={() => setActiveParade(null)} 
        />
      )}
    </div>
  );
};

export default App;
