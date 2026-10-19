import { useEffect } from 'react';
import LegacyTeamApp from './App';
import BuildOptimizerPage from './character-build/BuildOptimizerPage';
import CatalogBrowser from './characters/CatalogBrowser';
import { catalogSnapshot } from './data/real/catalog';
import { productionRegistry } from './data/real/character-build/registry';
import DefinitionWorkbench from './character-definitions/DefinitionWorkbench';

export default function Workbench() {
  const legacy =
    new URLSearchParams(window.location.search).get('workbench') ===
    'legacy-team';
  const builds =
    new URLSearchParams(window.location.search).get('workbench') ===
    'character-build';
  const params = new URLSearchParams(window.location.search);
  const catalog =
    params.get('workbench') === 'catalog' ||
    (!legacy && !builds && params.has('state'));
  const definitions = !legacy && !builds && !catalog;
  useEffect(() => {
    document.title = legacy
      ? 'Dokkan Team Lab · Legacy synthetic demo'
      : builds
        ? 'Dokkan Character Builds · Build optimizer'
        : catalog
          ? 'Dokkan Character Catalog · Admitted records'
          : 'Dokkan Character Lab · Definitions and custom builds';
  }, [legacy, builds, catalog]);
  return (
    <>
      <header className="workbench-switch">
        <strong>DOKKAN / CHARACTER LAB</strong>
        <nav aria-label="Workbench">
          <a
            href={import.meta.env.BASE_URL}
            aria-current={definitions ? 'page' : undefined}
          >
            Character editor
          </a>
          <a
            href={`${import.meta.env.BASE_URL}?workbench=catalog`}
            aria-current={catalog ? 'page' : undefined}
          >
            Character catalog
          </a>
          <a
            href={`${import.meta.env.BASE_URL}?workbench=character-build`}
            aria-current={builds ? 'page' : undefined}
          >
            Source build examples
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
      ) : catalog ? (
        <CatalogBrowser />
      ) : (
        <DefinitionWorkbench />
      )}
    </>
  );
}
