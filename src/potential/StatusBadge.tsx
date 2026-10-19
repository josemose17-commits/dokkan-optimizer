import type { ObjectiveStatus } from './capabilities';

const LABELS: Record<ObjectiveStatus, string> = {
  supported: 'Supported',
  experimental: 'Experimental',
  unavailable: 'Unavailable',
};

export default function StatusBadge({ status }: { status: ObjectiveStatus }) {
  return (
    <span className={`po-badge po-badge-${status}`}>{LABELS[status]}</span>
  );
}
