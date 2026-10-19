import type { BuildRequest, ComparisonResult, EvaluatorEntry } from './domain';
import { createComparison } from './comparison';
import { candidateBuilds } from './generation';
import { buildErrors } from './legality';

export interface SearchProgress {
  scanned: number;
  evaluated: number;
  rejected: number;
}
export type StopReason =
  'complete' | 'candidate-limit' | 'scan-limit' | 'cancelled' | 'error';
export interface SearchOutcome {
  comparison: ComparisonResult;
  progress: SearchProgress;
  stop: StopReason;
}
export interface SearchControl {
  maxScanned: number;
  chunkSize?: number;
  cancelled: () => boolean;
  progress?: (progress: SearchProgress) => void;
  // Host supplies scheduling: browser tasks or an independent test clock.
  yieldControl: () => Promise<void>;
}

/** Cooperative bounded enumeration; every rejected combination costs budget. */
export async function searchBuilds(
  input: BuildRequest,
  entry: EvaluatorEntry,
  control: SearchControl,
): Promise<SearchOutcome> {
  if (
    !Number.isSafeInteger(control.maxScanned) ||
    control.maxScanned < 1 ||
    control.maxScanned > 1_000_000
  )
    throw new Error('Scan budget must be an integer from 1 to 1000000.');
  const chunk = control.chunkSize ?? 128;
  if (!Number.isSafeInteger(chunk) || chunk < 1 || chunk > 1024)
    throw new Error('Chunk size must be an integer from 1 to 1024.');
  const request = structuredClone(input);
  const comparison = createComparison(request, entry);
  const progress: SearchProgress = { scanned: 0, evaluated: 0, rejected: 0 };
  let stop: StopReason = comparison.result.errors.length ? 'error' : 'complete';
  const publish = () => control.progress?.({ ...progress });
  if (stop !== 'error') {
    const candidates = candidateBuilds(request, entry);
    while (true) {
      if (control.cancelled()) {
        stop = 'cancelled';
        break;
      }
      const next = candidates.next();
      if (next.done) break;
      if (progress.scanned === control.maxScanned) {
        stop = 'scan-limit';
        break;
      }
      progress.scanned++;
      const errors = buildErrors(next.value, request, entry.model);
      if (errors.length) progress.rejected++;
      else {
        if (progress.evaluated === request.maxCandidates) {
          stop = 'candidate-limit';
          break;
        }
        if (!comparison.accept(next.value)) {
          stop = 'error';
          break;
        }
        progress.evaluated++;
      }
      if (progress.scanned % chunk === 0) {
        publish();
        await control.yieldControl();
      }
    }
    candidates.return(undefined);
  }
  publish();
  const finalized = await comparison.finishAsync(
    stop !== 'complete' && stop !== 'error',
    {
      cancelled: control.cancelled,
      yieldControl: control.yieldControl,
      chunkSize: chunk,
    },
  );
  if (finalized.cancelled) stop = 'cancelled';
  return {
    comparison: finalized.result,
    progress,
    stop,
  };
}
