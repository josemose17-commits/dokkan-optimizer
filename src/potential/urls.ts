export const recommendationHref = (stateId: string) =>
  `${import.meta.env.BASE_URL}?workbench=optimizer&state=${encodeURIComponent(stateId)}`;
