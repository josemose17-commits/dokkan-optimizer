import { useEffect } from 'react';
import LegacyTeamApp from './App';
import CharacterWorkbench from './character-build/CharacterWorkbench';

export default function Workbench() {
  const legacy =
    new URLSearchParams(window.location.search).get('workbench') ===
    'legacy-team';
  useEffect(() => {
    document.title = legacy
      ? 'Dokkan Team Lab · Legacy synthetic demo'
      : 'Dokkan Character Builds · Limited workbench';
  }, [legacy]);
  return (
    <>
      <header className="workbench-switch">
        <strong>DOKKAN / CHARACTER BUILDS</strong>
        <nav aria-label="Workbench">
          <a
            href={import.meta.env.BASE_URL}
            aria-current={!legacy ? 'page' : undefined}
          >
            Character workbench
          </a>
          <a
            href={`${import.meta.env.BASE_URL}?workbench=legacy-team`}
            aria-current={legacy ? 'page' : undefined}
          >
            Legacy synthetic team demo
          </a>
        </nav>
      </header>
      {legacy ? <LegacyTeamApp /> : <CharacterWorkbench />}
    </>
  );
}
