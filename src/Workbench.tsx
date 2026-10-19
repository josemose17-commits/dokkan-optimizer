import { useEffect } from 'react';
import { catalogSnapshot } from './data/real/catalog';
import { productionRegistry } from './data/real/character-build/registry';
import DefinitionWorkbench from './character-definitions/DefinitionWorkbench';
import PotentialOptimizer from './potential/PotentialOptimizer';

const PRODUCT = 'Dokkan Potential Optimizer';

export default function Workbench() {
  const params = new URLSearchParams(window.location.search);
  const workbench = params.get('workbench');
  const definitions = workbench === 'definitions';
  // Retired destinations intentionally return to the one workspace. Keep
  // exact state IDs, including unknown IDs; never substitute another state.
  useEffect(() => {
    if (
      ['legacy-team', 'character-build', 'catalog', 'tools'].includes(
        workbench ?? '',
      ) ||
      (workbench === null && params.has('state'))
    ) {
      const url = new URL(window.location.href);
      url.searchParams.set('workbench', 'optimizer');
      if (
        workbench === 'catalog' ||
        (workbench === null && params.has('state'))
      )
        url.searchParams.set('browse', '1');
      if (workbench === 'legacy-team') url.searchParams.set('retired', 'team');
      window.history.replaceState(null, '', url);
    }
  }, [workbench]);
  useEffect(() => {
    document.title = definitions
      ? `Character maintenance · ${PRODUCT}`
      : PRODUCT;
  }, [definitions]);
  const base = import.meta.env.BASE_URL;
  return (
    <>
      <header className="workbench-switch">
        <a className="app-brand" href={base}>
          {PRODUCT}
        </a>
        <details className="app-menu">
          <summary>Menu</summary>
          <nav aria-label="Secondary">
            {definitions && <a href={base}>Return to optimizer</a>}
            <a href={`${base}?workbench=definitions`}>
              Add, edit or import character data
            </a>
            <a href={`${base}?workbench=optimizer&browse=1`}>
              Character details and catalog import
            </a>
            <a href={`${base}?workbench=optimizer&about=1`}>
              About and sources
            </a>
          </nav>
        </details>
      </header>
      {definitions ? (
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
