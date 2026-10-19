import type {
  EvaluatorEntry,
  PotentialProfile,
} from '../character-build/domain';

// A documented aggregate profile is deliberately NOT a reconstructed board.
export interface PotentialTemplate {
  id: string;
  revision: string;
  kind: 'profile-snapshot' | 'choice-graph';
  coverage: 'partial' | 'complete-for-progression';
  profile: Omit<PotentialProfile, 'cardStateId'>;
  missing: string[];
}
export interface TemplateMapping {
  entryId: string;
  stateId: string;
  templateId: string;
  templateRevision: string;
  dataRevision: string;
  profileId: string;
  evidenceIds: string[];
}
export interface ProgressionCatalog {
  templates: PotentialTemplate[];
  mappings: TemplateMapping[];
}

export function resolveProgression(
  entry: EvaluatorEntry,
  catalog: ProgressionCatalog,
):
  | { ok: true; entry: EvaluatorEntry; template: PotentialTemplate }
  | { ok: false; reason: string } {
  const mappings = catalog.mappings.filter(
    (m) => m.entryId === entry.id && m.stateId === entry.stateId,
  );
  if (mappings.length !== 1)
    return {
      ok: false,
      reason: 'No unique exact-state potential-template mapping is admitted.',
    };
  const mapping = mappings[0]!;
  const templates = catalog.templates.filter(
    (t) =>
      t.id === mapping.templateId && t.revision === mapping.templateRevision,
  );
  if (templates.length !== 1)
    return {
      ok: false,
      reason: 'The pinned potential template is missing or ambiguous.',
    };
  const template = templates[0]!;
  if (
    !mapping.evidenceIds.length ||
    !mapping.evidenceIds.every((id) =>
      entry.model.evidence.some(
        (e) => e.id === id && e.status !== 'unresolved',
      ),
    )
  )
    return {
      ok: false,
      reason: 'Potential-template mapping evidence is missing.',
    };
  if (
    mapping.profileId !== entry.model.profile.id ||
    mapping.dataRevision !== entry.model.revision
  )
    return {
      ok: false,
      reason:
        'Potential template/profile revision does not match the selected evaluator.',
    };
  if (template.kind === 'profile-snapshot' && template.coverage !== 'partial')
    return {
      ok: false,
      reason:
        'An aggregate profile cannot establish complete choice-node topology.',
    };
  const ids = new Set(template.profile.nodes.map((n) => n.id));
  if (
    ids.size !== template.profile.nodes.length ||
    template.profile.nodes.some((n) =>
      n.prerequisites.some((id) => !ids.has(id)),
    )
  )
    return {
      ok: false,
      reason:
        'Potential template has duplicate nodes or unknown prerequisite references.',
    };
  if (
    template.coverage === 'complete-for-progression' &&
    template.missing.length
  )
    return {
      ok: false,
      reason:
        'A template with missing graph details cannot claim complete progression coverage.',
    };
  const profile: PotentialProfile = {
    ...structuredClone(template.profile),
    id: mapping.profileId,
    cardStateId: entry.stateId,
  };
  return {
    ok: true,
    entry: { ...entry, model: { ...entry.model, profile } },
    template,
  };
}

/** Converts existing admitted aggregates without inventing a shared game board. */
export function snapshotProgressions(
  entries: readonly EvaluatorEntry[],
): ProgressionCatalog {
  return {
    templates: entries.map((entry) => {
      const { cardStateId: _state, ...profile } = entry.model.profile;
      return {
        id: `profile-snapshot:${entry.id}`,
        revision: entry.model.revision,
        kind: 'profile-snapshot',
        coverage: 'partial',
        profile: structuredClone(profile),
        missing: [
          'Exact selectable node alternatives and increments',
          'Node connections, prerequisites and route/unlock gates',
          'Reviewed card-to-shared-board mapping for other progression states',
        ],
      };
    }),
    mappings: entries.map((entry) => ({
      entryId: entry.id,
      stateId: entry.stateId,
      templateId: `profile-snapshot:${entry.id}`,
      templateRevision: entry.model.revision,
      dataRevision: entry.model.revision,
      profileId: entry.model.profile.id,
      evidenceIds: [...entry.model.profile.evidenceIds],
    })),
  };
}
