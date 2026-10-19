import { useEffect } from 'react';
import LegacyTeamApp from './App';
import BuildOptimizerPage from './character-build/BuildOptimizerPage';
import CatalogBrowser from './characters/CatalogBrowser';
import { catalogSnapshot } from './data/real/catalog';
import { productionRegistry } from './data/real/character-build/registry';

export default function Workbench() {
  const legacy =
    new URLSearchParams(window.location.search).get('workbench') ===
    'legacy-team';
  const builds =
    new URLSearchParams(window.location.search).get('workbench') ===
    'character-build';
  useEffect(() => {
    document.title = legacy
      ? 'Dokkan Team Lab · Legacy synthetic demo'
      : builds
        ? 'Dokkan Character Builds · Build optimizer'
        : 'Dokkan Character Catalog · Admitted records';
  }, [legacy, builds]);
  return (
    <>
      <header className="workbench-switch">
        <strong>DOKKAN / CHARACTER CATALOG</strong>
        <nav aria-label="Workbench">
          <a
            href={import.meta.env.BASE_URL}
            aria-current={!legacy && !builds ? 'page' : undefined}
          >
            Character catalog
          </a>
          <a
            href={`${import.meta.env.BASE_URL}?workbench=character-build`}
            aria-current={builds ? 'page' : undefined}
          >
            Build optimizer
          </a>
          <a
            href={`${import.meta.env.BASE_URL}?workbench=legacy-team`}
            aria-current={legacy ? 'page' : undefined}
          >
            Legacy synthetic team demo
          </a>
        </nav>
      </header>
      {legacy ? (
        <LegacyTeamApp />
      ) : builds ? (
        <BuildOptimizerPage
          snapshot={catalogSnapshot}
          registry={productionRegistry}
        />
      ) : (
        <CatalogBrowser />
      )}
    </>
  );
}
