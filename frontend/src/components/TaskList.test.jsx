import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskList from './TaskList.jsx';

const baseTask = {
  id: 1,
  title: 'Rever relatório',
  description: 'Antes de sexta-feira',
  priority: 'high',
  status: 'pending',
  due_date: null,
  tags: ['urgente'],
};

describe('TaskList', () => {
  it('shows an empty state when there are no tasks', () => {
    render(<TaskList tasks={[]} onToggleStatus={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Ainda não há tarefas')).toBeInTheDocument();
  });

  it('renders a task with its priority badge, notes and tags', () => {
    render(<TaskList tasks={[baseTask]} onToggleStatus={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Rever relatório')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(screen.getByText('Antes de sexta-feira')).toBeInTheDocument();
    expect(screen.getByText('urgente')).toBeInTheDocument();
  });

  it('calls onToggleStatus with the task when the checkbox is clicked', async () => {
    const onToggleStatus = vi.fn();
    const user = userEvent.setup();
    render(<TaskList tasks={[baseTask]} onToggleStatus={onToggleStatus} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Marcar como concluída' }));

    expect(onToggleStatus).toHaveBeenCalledWith(baseTask);
  });

  it('only deletes after the confirmation dialog is accepted', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<TaskList tasks={[baseTask]} onToggleStatus={vi.fn()} onUpdate={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: 'Eliminar tarefa' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onDelete).toHaveBeenCalledWith(baseTask.id);
  });

  it('cancelling the delete dialog does not call onDelete', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<TaskList tasks={[baseTask]} onToggleStatus={vi.fn()} onUpdate={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: 'Eliminar tarefa' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('switches a task into an editable row and saves the new title', async () => {
    const onUpdate = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();
    render(<TaskList tasks={[baseTask]} onToggleStatus={vi.fn()} onUpdate={onUpdate} onDelete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Editar tarefa' }));
    const titleInput = screen.getByPlaceholderText('Título');
    await user.clear(titleInput);
    await user.type(titleInput, 'Rever relatório final');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onUpdate).toHaveBeenCalledWith(
      baseTask.id,
      expect.objectContaining({ title: 'Rever relatório final' })
    );
  });

  it('parses the comma-separated tags field, trimming each tag', async () => {
    const onUpdate = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();
    render(<TaskList tasks={[baseTask]} onToggleStatus={vi.fn()} onUpdate={onUpdate} onDelete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Editar tarefa' }));
    const tagsInput = screen.getByPlaceholderText('Etiquetas, separadas por vírgula');
    await user.clear(tagsInput);
    await user.type(tagsInput, 'urgente,  cliente vip ,  ');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onUpdate).toHaveBeenCalledWith(
      baseTask.id,
      expect.objectContaining({ tags: ['urgente', 'cliente vip'] })
    );
  });

  it('leaves the task unchanged when editing is cancelled', async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<TaskList tasks={[baseTask]} onToggleStatus={vi.fn()} onUpdate={onUpdate} onDelete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Editar tarefa' }));
    await user.type(screen.getByPlaceholderText('Título'), ' alterado');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('Rever relatório')).toBeInTheDocument();
  });
});
