export default function AssistantPage() {
  return (
    <div className="card" style={{ padding: '48px 32px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
      <span className="badge-priority medium">Brevemente — M4</span>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>Assistente de conversa</h1>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-muted)', maxWidth: 480 }}>
        Uma extensão de chat em linguagem natural para gerir tarefas — criar, procurar, atualizar e configurar
        automações a conversar, com a API da Claude e tool use. Ainda não construído: esta página é um placeholder
        para que a funcionalidade tenha o seu próprio espaço quando chegar, separado da lista de tarefas principal.
      </p>
    </div>
  );
}
