import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it } from 'vitest';
import PotentialOptimizer from './PotentialOptimizer';
import { catalogSnapshot } from '../data/real/catalog';
import {
  productionRegistry,
  gokuEntry,
} from '../data/real/character-build/registry';
import { GOHAN_STATE_ID } from '../data/real/character-build/gohan-kit';

const original = globalThis.window;
afterEach(() => {
  (globalThis as { window?: unknown }).window = original;
});
function page(state: string) {
  (globalThis as { window?: unknown }).window = {
    location: {
      search: `?workbench=optimizer&state=${encodeURIComponent(state)}`,
    },
    localStorage: { getItem: () => null },
  };
  return renderToStaticMarkup(
    createElement(PotentialOptimizer, {
      snapshot: catalogSnapshot,
      registry: productionRegistry,
    }),
  );
}
it('renders reviewed Gohan kit guidance without borrowing the numerical Goku workspace', () => {
  const html = page(GOHAN_STATE_ID);
  expect(html).toContain('Additional-led priorities');
  expect(html).toContain('Slot 1');
  expect(html).toContain('Cannot recommend exact levels or items yet');
  expect(html).toContain('No numerical winning allocation');
  expect(html).not.toContain('aria-label="Optimize and result"');
  expect(html).not.toContain('name="objective"');
});
it('retains the limited Goku comparison and saved-build component', () => {
  const html = page(gokuEntry.stateId);
  expect(html).toContain('Limited progression-profile / equipment comparison');
  expect(html).toContain('Current silver equipment');
  expect(html).toContain('Saved builds · save, load or export');
  expect(html).toContain('Full allocation support not available');
  expect(html).not.toContain('Additional-led priorities');
});
it('does not fall back for an unknown exact state', () => {
  const html = page('missing-state');
  expect(html).toContain('State missing-state is not in this catalog');
  expect(html).not.toContain('aria-label="Optimize and result"');
  expect(html).not.toContain('aria-label="Character analysis"');
});
