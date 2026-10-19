import {
  AVAILABLE_METRICS,
  type EvaluatorEntry,
} from '../../../character-build/domain';
import { initialCheckEvaluator } from '../../../character-build/evaluation';
import { WORKING_SETTINGS_KEY } from '../../../character-build/registry';
import {
  CARD_STATE_ID,
  CATALOG_CARD_ID,
  characterCatalog,
  defaultRequest,
} from './goku';

// Production evaluator registry. Each entry binds ONE exact catalog state to
// its evaluation data; the catalog state names the entry by ID. Test-only
// fixtures live in src/character-build/registry.fixtures.ts and never here.
export const gokuEntry: EvaluatorEntry = {
  id: 'goku-initial-check-v1',
  catalogCardId: CATALOG_CARD_ID,
  stateId: CARD_STATE_ID,
  model: characterCatalog,
  contexts: [
    {
      id: 'initial-check-v1',
      label: 'Initial eligible check',
      assumptions: [
        'Turn 1, first appearance',
        'The initial attack is a Super Attack',
        'No external effects (leader, links, support or passive chances)',
      ],
      evasionOptions: [true, false],
    },
  ],
  objectives: [...AVAILABLE_METRICS],
  evaluator: initialCheckEvaluator,
  // The original working-settings key and payload contract are unchanged.
  storageKey: WORKING_SETTINGS_KEY,
  defaults: defaultRequest,
};

export const productionRegistry: readonly EvaluatorEntry[] = [gokuEntry];
