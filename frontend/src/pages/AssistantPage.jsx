export default function AssistantPage() {
  return (
    <div className="card" style={{ padding: '48px 32px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
      <span className="badge-priority medium">Coming in M4</span>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>Chat assistant</h1>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-muted)', maxWidth: 480 }}>
        A natural-language chat extension for managing tasks — create, search, update, and set up automations by
        talking to it, powered by the Claude API with tool use. Not built yet: this page is a placeholder so the
        feature has its own space once it lands, separate from the core task list.
      </p>
    </div>
  );
}
