import {
  SKILLS,
  type Build,
  type BuildRequest,
  type ChoiceNode,
  type Contribution,
  type CustomPotential,
  type EvaluatorEntry,
  type Route,
  type Skill,
  type Skills,
  type Stats,
} from './domain';

// Hidden Potential allocations: which potential contributions a build uses,
// separate from equipment. Candidate generation enumerates attainable
// allocations here and combines them with equipment pools; evaluation reads
// each allocation's contributions from here.

// Reserved progression ID for user-entered totals.
export const CUSTOM_PROFILE_ID = 'custom-potential';
// Technical input bounds that keep arithmetic finite; NOT game limits.
export const CUSTOM_POTENTIAL_LIMITS = {
  skillLevel: 40,
  stat: 50_000,
} as const;
export const ROUTES: readonly Route[] = [
  'topLeft',
  'topRight',
  'bottomLeft',
  'bottomRight',
];
const STAT_KEYS = ['hp', 'attack', 'defense'] as const;

const bounded = (n: unknown, max: number) =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= max;

export function customPotentialErrors(value: CustomPotential): string[] {
  const errors: string[] = [];
  for (const skill of SKILLS)
    if (!bounded(value.skills[skill], CUSTOM_POTENTIAL_LIMITS.skillLevel))
      errors.push(
        `Enter a whole number from 0 to ${CUSTOM_POTENTIAL_LIMITS.skillLevel} for ${skill} levels.`,
      );
  for (const stat of STAT_KEYS)
    if (!bounded(value.stats[stat], CUSTOM_POTENTIAL_LIMITS.stat))
      errors.push(
        `Enter a whole number from 0 to ${CUSTOM_POTENTIAL_LIMITS.stat.toLocaleString('en-US')} for the ${stat} addition.`,
      );
  return errors;
}

export type AllocationOrigin = 'fixed-profile' | 'choice-graph' | 'custom';
export interface AllocationSpace {
  origin: AllocationOrigin;
  // Activated choice nodes that the search varies, in progression order.
  nodes: Pick<ChoiceNode, 'id' | 'route' | 'levels' | 'options'>[];
  // Exact number of attainable allocations for this progression.
  count: number;
}

export function allocationOrigin(request: BuildRequest, entry: EvaluatorEntry) {
  if (request.customPotential) return 'custom' as const;
  return entry.model.profile.nodes.length
    ? ('choice-graph' as const)
    : ('fixed-profile' as const);
}

function activatedNodes(request: BuildRequest, entry: EvaluatorEntry) {
  if (request.customPotential) return [];
  return request.progression.activatedNodes.map((id) => {
    const node = entry.model.profile.nodes.find((n) => n.id === id);
    if (!node) throw new Error(`Unknown activated node ${id}.`);
    return node;
  });
}

// Callers validate the request first (requestErrors); unknown nodes throw.
export function allocationSpace(
  request: BuildRequest,
  entry: EvaluatorEntry,
): AllocationSpace {
  const nodes = activatedNodes(request, entry);
  return {
    origin: allocationOrigin(request, entry),
    nodes: nodes.map(({ id, route, levels, options }) => ({
      id,
      route,
      levels,
      options: [...options],
    })),
    count: nodes.reduce((product, node) => product * node.options.length, 1),
  };
}

// Every attainable allocation: one option per activated choice node. A fixed
// profile or user-entered totals have exactly one allocation (no choices).
export function* attainableAllocations(
  request: BuildRequest,
  entry: EvaluatorEntry,
): Generator<Record<string, Skill>> {
  const nodes = activatedNodes(request, entry);
  function* choose(
    index: number,
    selected: Record<string, Skill>,
  ): Generator<Record<string, Skill>> {
    const node = nodes[index];
    if (!node) {
      yield selected;
      return;
    }
    for (const option of node.options)
      yield* choose(index + 1, { ...selected, [node.id]: option });
  }
  yield* choose(0, {});
}

const nonZero = <K extends string>(values: Partial<Record<K, number>>) =>
  Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== 0 && v !== undefined),
  ) as Partial<Record<K, number>>;

// Potential contributions of one build, by source: a documented profile's
// fixed stats/skills plus each selected choice, or the user's entered totals.
export function potentialContributions(
  build: Build,
  request: BuildRequest,
  entry: EvaluatorEntry,
): {
  stats: Contribution<Partial<Stats>>[];
  skills: Contribution<Partial<Skills>>[];
} {
  const base = { slot: null, itemId: null, nodeId: null };
  const custom = request.customPotential;
  if (custom)
    return {
      stats: [
        {
          ...base,
          source: 'custom',
          label:
            'Your potential stat additions (board requirements not checked)',
          values: { ...custom.stats },
          evidenceIds: [],
        },
      ],
      skills: [
        {
          ...base,
          source: 'custom',
          label: 'Your potential skill levels (board requirements not checked)',
          values: nonZero(custom.skills),
          evidenceIds: [],
        },
      ],
    };
  const { profile } = entry.model;
  return {
    stats: [
      {
        ...base,
        source: 'potential',
        label: `Hidden Potential: ${profile.label}`,
        values: { ...profile.statBonus },
        evidenceIds: profile.evidenceIds,
      },
    ],
    skills: [
      {
        ...base,
        source: 'potential',
        label: `Fixed skills: ${profile.label}`,
        values: nonZero(profile.fixedSkills),
        evidenceIds: profile.evidenceIds,
      },
      ...Object.entries(build.choices).map(
        ([id, skill]): Contribution<Partial<Skills>> => {
          const node = profile.nodes.find((n) => n.id === id)!;
          return {
            ...base,
            source: 'node',
            label: `Choice node ${id}: ${skill}`,
            nodeId: id,
            values: { [skill]: node.levels },
            evidenceIds: node.evidenceIds,
          };
        },
      ),
    ],
  };
}

// A user-entered starting point equal to the current documented allocation
// (fixed profile plus current choices), so switching to custom values changes
// nothing until the user edits them.
export function customFromCurrent(
  request: BuildRequest,
  entry: EvaluatorEntry,
): CustomPotential {
  if (request.customPotential) return structuredClone(request.customPotential);
  const skills: Skills = { ...entry.model.profile.fixedSkills };
  for (const [id, skill] of Object.entries(request.current.choices)) {
    const node = entry.model.profile.nodes.find((n) => n.id === id);
    if (node) skills[skill] += node.levels;
  }
  return { skills, stats: { ...entry.model.profile.statBonus } };
}
