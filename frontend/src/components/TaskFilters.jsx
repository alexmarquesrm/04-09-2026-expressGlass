export default function TaskFilters({ status, onStatusChange, priority, onPriorityChange }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <select className="field-sm" value={status} onChange={(e) => onStatusChange(e.target.value)} aria-label="Filtrar por estado">
        <option value="all">Todos os estados</option>
        <option value="pending">Pendente</option>
        <option value="completed">Concluída</option>
      </select>
      <select className="field-sm" value={priority} onChange={(e) => onPriorityChange(e.target.value)} aria-label="Filtrar por prioridade">
        <option value="all">Todas as prioridades</option>
        <option value="low">Baixa</option>
        <option value="medium">Média</option>
        <option value="high">Alta</option>
      </select>
    </div>
  );
}
