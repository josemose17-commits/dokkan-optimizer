// Secondary tools: still available, deliberately not part of the main flow.
export default function ToolsPage() {
  const base = import.meta.env.BASE_URL;
  const tools = [
    {
      href: `${base}?workbench=definitions`,
      name: 'Character maintenance',
      text: 'Record a character the catalog does not have yet, keep revisions, and compare custom builds with a calculation trace. User-entered data stays in this browser and is not optimized automatically.',
    },
    {
      href: `${base}?workbench=character-build`,
      name: 'Source build examples',
      text: 'The original equipment comparator for the documented Goku profile, with its saved working settings and detailed result explanations.',
    },
    {
      href: `${base}?workbench=legacy-team`,
      name: 'Legacy synthetic team demo',
      text: 'The earliest team-building prototype with fictional units. Its scores are not real Dokkan recommendations.',
    },
  ];
  return (
    <main className="po-page">
      <header className="po-hero">
        <p className="po-eyebrow">TOOLS</p>
        <h1>Secondary tools.</h1>
        <p>
          Maintenance and reference workbenches. The optimizer is the main
          product; these remain available for authoring and comparison.
        </p>
      </header>
      <ul className="po-tools">
        {tools.map((tool) => (
          <li key={tool.href} className="po-card">
            <h2>
              <a href={tool.href}>{tool.name}</a>
            </h2>
            <p>{tool.text}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
