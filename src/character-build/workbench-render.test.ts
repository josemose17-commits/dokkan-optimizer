import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { gokuEntry } from '../data/real/character-build/registry';
import BuildOptimizerPage, { identityFor } from './BuildOptimizerPage';
import CharacterWorkbench from './CharacterWorkbench';
import type { EvaluatorEntry } from './domain';
import {
  FIXTURE_BORROWING_STATE,
  FIXTURE_NODE_STATE,
  FIXTURE_STATS_STATE,
  fixtureNodeEntry,
  fixtureStatsEntry,
  registryFixtureSnapshot,
} from './registry.fixtures';
import { resolveEvaluator } from './registry';

// Renders the real components with TEST ONLY characters (server-side, no
// browser): the UI must take every identity, slot, context and objective
// from the registry entry, with nothing Goku-specific left over.
const snapshot = registryFixtureSnapshot();
const registry: EvaluatorEntry[] = [
  gokuEntry,
  fixtureNodeEntry,
  fixtureStatsEntry,
];
const render = (entry: EvaluatorEntry) => {
  const resolution = resolveEvaluator(registry, snapshot, entry.stateId);
  if (!resolution.ok) throw new Error(resolution.reason);
  return renderToStaticMarkup(
    createElement(CharacterWorkbench, {
      entry,
      identity: identityFor(snapshot, resolution.state),
      available: registry,
      pending: null,
      onOpen: () => undefined,
    }),
  );
};
const options = (html: string, label: string) => {
  const select = html.split(label)[1]?.split('</select>')[0] ?? '';
  return [...select.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map(
    (m) => m[1],
  );
};

describe('workbench rendering per registry entry', () => {
  it('renders the fixture character with its own slots, node and objectives', () => {
    const html = render(fixtureNodeEntry);
    expect(html).toContain('Optimize TEST ONLY Fixture Fighter');
    expect(html).toContain('Extreme INT UR');
    expect(html).toContain('Current gold equip');
    expect(html).toContain('TEST ONLY gold critical +3');
    expect(html).toContain('Current choice at test-only-node-a (+2 levels)');
    expect(options(html, 'Sort by supported objective')).toEqual([
      'Card ATK',
      'Initial extra Super',
      'Critical chance',
      'Evasion chance',
    ]);
    // Only one evasion option is declared, so no selector is offered.
    expect(html).toContain('fixed by this evaluator: evasion allowed');
    expect(html).not.toContain('Incoming-attack assumption</label>');
    for (const leak of ['Goku', 'AGL ATK +500', '1003211', 'Mystery Super'])
      expect(html).not.toContain(leak);
  });
  it('locks slots without eligible items and offers only stat objectives for a stats-only evaluator', () => {
    const html = render(fixtureStatsEntry);
    expect(html).toContain('Silver slot locked');
    expect(html).toContain('Gold slot locked');
    expect(options(html, 'Current bronze equip')).toEqual([
      'Empty',
      'TEST ONLY TEQ bronze HP +100',
    ]);
    expect(options(html, 'Sort by supported objective')).toEqual([
      'Card ATK',
      'Card DEF',
      'Card HP',
    ]);
    expect(html).not.toContain('Goku');
  });
  it('keeps the production Goku page identical in identity', () => {
    const html = render(gokuEntry);
    expect(html).toContain('Optimize Super Saiyan 3 Goku');
    expect(html).toContain('EZA step 7 · without Super EZA · Lv.140 · SA15');
    expect(html).toContain('16 compatible targets evaluated');
  });
});

describe('optimizer page selection', () => {
  const original = globalThis.window;
  afterEach(() => {
    (globalThis as { window?: unknown }).window = original;
  });
  const page = (search: string) => {
    (globalThis as { window?: unknown }).window = { location: { search } };
    return renderToStaticMarkup(
      createElement(BuildOptimizerPage, { snapshot, registry }),
    );
  };
  it('lists the registered states when no state is requested', () => {
    const html = page('?workbench=character-build');
    expect(html).toContain('3 exact states with an evaluator');
    expect(html).not.toContain('Compare compatible configurations');
  });
  it('opens the requested state’s own workbench', () => {
    const html = page(`?state=${encodeURIComponent(FIXTURE_STATS_STATE)}`);
    expect(html).toContain('Optimize TEST ONLY Stats Dummy');
    expect(html).not.toContain('Optimize Super Saiyan 3 Goku');
  });
  it('shows the exact reason instead of falling back to another evaluator', () => {
    const html = page(`?state=${encodeURIComponent(FIXTURE_BORROWING_STATE)}`);
    expect(html).toContain('Optimization unavailable');
    expect(html).toContain('never reused for another card or state');
    expect(html).not.toContain('Compare compatible configurations');
    expect(html).not.toContain('Optimize Super Saiyan 3 Goku');
  });
  it('treats an unknown state as unavailable, not as the default character', () => {
    const html = page('?state=not-a-state');
    expect(html).toContain('State not-a-state is not in this catalog.');
    expect(html).not.toContain('Compare compatible configurations');
    expect(page(`?state=${FIXTURE_NODE_STATE}`)).toContain(
      'Optimize TEST ONLY Fixture Fighter',
    );
  });
});
