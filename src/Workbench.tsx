import { useEffect } from 'react';
import LegacyTeamApp from './App';
import BuildOptimizerPage from './character-build/BuildOptimizerPage';
import CatalogBrowser from './characters/CatalogBrowser';
import { catalogSnapshot } from './data/real/catalog';
import { productionRegistry } from './data/real/character-build/registry';
import DefinitionWorkbench from './character-definitions/DefinitionWorkbench';
import PotentialOptimizer from './potential/PotentialOptimizer';
import ToolsPage from './ToolsPage';

const PRODUCT = 'Dokkan Potential Optimizer';

export default function Workbench() {
  const params = new URLSearchParams(window.location.search);
  const workbench = params.get('workbench');
  const legacy = workbench === 'legacy-team';
  const builds = workbench === 'character-build';
  // Old bare `?state=...` links keep opening the catalog.
  const catalog =
    workbench === 'catalog' || (workbench === null && params.has('state'));
  const definitions = workbench === 'definitions';
  const tools = workbench === 'tools';
  const tool = legacy || builds || definitions || tools;
  const optimizer = !tool && !catalog;
  useEffect(() => {
    document.title = legacy
      ? `Legacy synthetic team demo · ${PRODUCT}`
      : builds
        ? `Source build examples · ${PRODUCT}`
        : catalog
          ? `Characters · ${PRODUCT}`
          : definitions
            ? `Character maintenance · ${PRODUCT}`
            : tools
              ? `Tools · ${PRODUCT}`
              : PRODUCT;
  }, [legacy, builds, catalog, definitions, tools]);
  const base = import.meta.env.BASE_URL;
  return (
    <>
      <header className="workbench-switch">
        <a className="app-brand" href={base}>
          {PRODUCT}
        </a>
        <nav aria-label="Main">
          <a href={base} aria-current={optimizer ? 'page' : undefined}>
            Optimize
          </a>
          <a
            href={`${base}?workbench=catalog`}
            aria-current={catalog ? 'page' : undefined}
          >
            Characters
          </a>
          <a
            href={`${base}?workbench=tools`}
            aria-current={tool ? 'page' : undefined}
          >
            Tools
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
      ) : tools ? (
        <ToolsPage />
      ) : (
        <PotentialOptimizer
          snapshot={catalogSnapshot}
          registry={productionRegistry}
        />
      )}
    </>
  );
}
