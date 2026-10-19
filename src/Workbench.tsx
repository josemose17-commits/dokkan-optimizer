import { useEffect } from 'react';
import LegacyTeamApp from './App';
import BuildOptimizerPage from './character-build/BuildOptimizerPage';
import CatalogBrowser from './characters/CatalogBrowser';
import { catalogSnapshot } from './data/real/catalog';
import { productionRegistry } from './data/real/character-build/registry';
import DefinitionWorkbench from './character-definitions/DefinitionWorkbench';
import PotentialOptimizer from './potential/PotentialOptimizer';

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
    (params.get('workbench') === null && params.has('state'));
  const definitions = params.get('workbench') === 'definitions';
  const optimizer = !legacy && !builds && !catalog && !definitions;
  useEffect(() => {
    document.title = legacy
      ? 'Dokkan Team Lab · Legacy synthetic demo'
      : builds
        ? 'Dokkan Character Builds · Equip comparison'
        : catalog
          ? 'Dokkan Character Catalog · Admitted records'
          : definitions
            ? 'Dokkan Character Lab · Definitions and custom builds'
            : 'Dokkan · Profile/equipment comparison';
  }, [legacy, builds, catalog, definitions]);
  return (
    <>
      <header className="workbench-switch">
        <strong>DOKKAN / PROFILE COMPARISON</strong>
        <nav aria-label="Workbench">
          <a
            href={import.meta.env.BASE_URL}
            aria-current={optimizer ? 'page' : undefined}
          >
            Profile/equipment comparison
          </a>
          <a
            href={`${import.meta.env.BASE_URL}?workbench=definitions`}
            aria-current={definitions ? 'page' : undefined}
          >
            Character maintenance
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
      ) : definitions ? (
        <DefinitionWorkbench />
      ) : (
        <PotentialOptimizer
          snapshot={catalogSnapshot}
          registry={productionRegistry}
        />
      )}
    </>
  );
}
