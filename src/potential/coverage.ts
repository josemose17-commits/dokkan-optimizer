import type { CatalogSnapshot } from '../character-data/domain';
import { DETAIL_LABELS } from '../character-data/domain';
import type { EvaluatorEntry } from '../character-build/domain';
import { resolveEvaluator } from '../character-build/registry';
import type { ProgressionCatalog } from './progression';

export const COVERAGE_LABELS: Record<
  keyof ReturnType<typeof catalogCoverage>,
  string
> = {
  cardForms: 'Unique card forms',
  awakeningRelationships: 'Established awakening relationships',
  ezaStates: 'EZA states',
  sezaStates: 'SEZA states',
  completeRequiredRecords: 'Complete required-detail records',
  evaluatorStates: 'States with a limited evaluator',
  incompleteRecords: 'Incomplete detail records',
  ambiguousFormMappings: 'Ambiguous form mappings',
  unparsedRecords: 'Explicit unparsed/excluded source records',
  completeBoardTemplates: 'Complete board templates',
  sourceTotal: 'Source catalog total',
};

export function catalogCoverage(
  snapshot: CatalogSnapshot,
  registry: readonly EvaluatorEntry[],
  progressions: ProgressionCatalog,
) {
  return {
    cardForms: snapshot.cards.length,
    awakeningRelationships: snapshot.cards.filter((c) => c.fromCardId !== null)
      .length,
    ezaStates: snapshot.states.filter((s) => s.awakening.kind === 'eza').length,
    sezaStates: snapshot.states.filter((s) => s.awakening.kind === 'seza')
      .length,
    completeRequiredRecords: snapshot.states.filter(
      (s) =>
        Object.keys(DETAIL_LABELS).every(
          (k) =>
            s.fields[k as keyof typeof s.fields].completeness === 'complete',
        ) &&
        s.region !== null &&
        s.awakening.kind !== 'unknown',
    ).length,
    evaluatorStates: snapshot.states.filter(
      (s) => resolveEvaluator(registry, snapshot, s.id).ok,
    ).length,
    incompleteRecords: snapshot.states.filter((s) =>
      Object.values(s.fields).some((f) => f.completeness !== 'complete'),
    ).length,
    ambiguousFormMappings: snapshot.cards.filter((c) => c.form === 'unknown')
      .length,
    unparsedRecords: snapshot.coverage.excluded.length,
    completeBoardTemplates: progressions.templates.filter(
      (t) =>
        t.kind === 'choice-graph' && t.coverage === 'complete-for-progression',
    ).length,
    sourceTotal: snapshot.coverage.sourceCardCount,
  };
}
