import { useState } from 'react';
import { FiresApp } from './firms/FiresApp';
import { DigitalTwinApp } from './DigitalTwinApp';
import { GlobalNav, type AppView } from './components/GlobalNav';

/**
 * Top-level shell. Both products share one chrome:
 *   - "live": NASA FIRMS nationwide active-fire monitor for India.
 *   - "twin": incident digital twin / tactical replay walkthrough.
 *
 * Views stay mounted once opened and are hidden rather than torn down, so switching
 * tabs mid-demo never re-fetches the FIRMS feed or resets replay/what-if state. The
 * twin mounts lazily so its Leaflet map is only built while visible and correctly
 * sized; the synthetic resize lets Leaflet re-measure whenever a view comes back.
 */
export function App() {
  const [view, setView] = useState<AppView>('live');
  const [twinOpened, setTwinOpened] = useState(false);

  const handleSelectView = (next: AppView) => {
    setView(next);
    if (next === 'twin') setTwinOpened(true);
    // Leaflet tracks window resize; nudge it once the container is visible again.
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <GlobalNav view={view} onSelectView={handleSelectView} />

      <div className="relative min-h-0 flex-1">
        <div className={view === 'live' ? 'h-full' : 'hidden'}>
          <FiresApp />
        </div>
        {twinOpened && (
          <div className={view === 'twin' ? 'h-full' : 'hidden'}>
            <DigitalTwinApp />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
