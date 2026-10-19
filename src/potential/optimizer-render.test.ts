import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CUSTOM_PROFILE_ID,
  customFromCurrent,
} from '../character-build/allocation';
import type { BuildRequest, EvaluatorEntry } from '../character-build/domain';
import {
  fixtureNodeEntry,
  fixtureStatsEntry,
} from '../character-build/registry.fixtures';
import { gokuEntry } from '../data/real/character-build/registry';
import { resolveCapabilities } from './capabilities';
import CurrentBuild from './CurrentBuild';
import GoalSettings from './GoalSettings';
import { snapshotProgressions } from './progression';

// Server-rendered components: what each step offers comes from the entry and
// its resolved capabilities, never from a fixed Goku layout.
const noop = () => undefined;
function current(entry: EvaluatorEntry, request = entry.defaults()) {
  return renderToStaticMarkup(
    createElement(CurrentBuild, {
      entry,
      request,
      capabilities: resolveCapabilities(entry, snapshotProgressions([entry])),
      evaluation: null,
      onChange: noop,
    }),
  );
}
function goals(entry: EvaluatorEntry, objectiveChosen = false) {
  return renderToStaticMarkup(
    createElement(GoalSettings, {
      entry,
      request: entry.defaults(),
      capabilities: resolveCapabilities(entry, snapshotProgressions([entry])),
      objectiveChosen,
      budget: 1000,
      estimate: null,
      onChange: noop,
      onObjective: noop,
      onBudget: noop,
    }),
  );
}
const count = (html: string, text: string) => html.split(text).length - 1;

describe('current build step', () => {
  it('shows a single documented progression as a summary, not a selector', () => {
    const html = current(gokuEntry);
    expect(html).toContain('55% · base board filled · no duplicate routes');
    expect(html).toContain(
      'One fixed allocation: no selectable choice nodes are documented for this profile.',
    );
    expect(html).not.toMatch(/Supported progression|Recommendation scope/);
    expect(count(html, '<select')).toBe(3); // bronze, silver, gold only
    expect(html).toMatch(/aria-label="Current gold equipment" disabled=""/);
    expect(html).toContain('My current values');
  });

  it('shows real choice nodes only when a template supplies them (TEST ONLY)', () => {
    const html = current(fixtureNodeEntry);
    expect(html).toContain(
      'test-only-node-a unlocked · +2 to Critical Hit or Evasion',
    );
    expect(html).not.toContain('One fixed allocation');
  });

  it('offers entered values only when the evaluator accepts them', () => {
    expect(current(fixtureStatsEntry)).not.toContain('My current values');
  });

  it('labels entered values once', () => {
    const r: BuildRequest = {
      ...gokuEntry.defaults(),
      progression: {
        ...gokuEntry.defaults().progression,
        profileId: CUSTOM_PROFILE_ID,
      },
      customPotential: customFromCurrent(gokuEntry.defaults(), gokuEntry),
    };
    const html = current(gokuEntry, r);
    expect(count(html, 'Board requirements not checked.')).toBe(1);
    expect(html).toContain('Critical Hit levels');
    expect(html).toContain('ATK addition');
  });
});

describe('goal step', () => {
  it('groups objectives by model status with no preselection', () => {
    const html = goals(gokuEntry);
    expect(count(html, 'type="radio" name="objective"')).toBe(6);
    expect(html).not.toMatch(/name="objective"[^>]*checked/);
    expect(html).toContain('Supported</span>');
    expect(html).toContain('Experimental</span>');
    expect(html).toContain('Expected damage:');
    expect(html).toContain('Damage taken and survival:');
  });

  it('disables an objective a kit mechanic blocks, with its reason', () => {
    const entry: EvaluatorEntry = {
      ...gokuEntry,
      model: {
        ...gokuEntry.model,
        kit: {
          ...gokuEntry.model.kit,
          nativeCritical: {
            status: 'present',
            evidenceIds: ['eza-kit'],
            note: 'TEST ONLY',
          },
        },
      },
    };
    const html = goals(entry);
    expect(html).toMatch(/disabled="" name="objective" value="critical"/);
    expect(html).toContain(
      'Unavailable: Native critical-hit chance: part of this kit but not modeled. It could change this result.',
    );
  });
});
