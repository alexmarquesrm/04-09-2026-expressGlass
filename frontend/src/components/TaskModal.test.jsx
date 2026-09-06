import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskModal from './TaskModal.jsx';

const columns = [
  { id: 1, name: 'A fazer' },
  { id: 2, name: 'Feito' },
];

const members = [
  { user_id: 1, name: 'Ana Costa' },
  { user_id: 2, name: 'Bruno Santos' },
];

const baseTask = {
  id: 10,
  title: 'Preparar demo',
  description: '',
  column_id: 1,
  priority: 'medium',
  labels: [],
  assignees: [{ user_id: 1, name: 'Ana Costa' }],
};

function renderModal(overrides = {}) {
  const onSave = vi.fn().mockResolvedValue({});
  const onDelete = vi.fn();
  const onClose = vi.fn();
  render(
    <TaskModal
      task={baseTask}
      columns={columns}
      members={members}
      onSave={onSave}
      onDelete={onDelete}
      onClose={onClose}
      {...overrides}
    />
  );
  return { onSave, onDelete, onClose };
}

describe('TaskModal', () => {
  it('shows a chip only for the already-assigned member, not everyone', () => {
    renderModal();
    expect(screen.getByText('Ana Costa')).toBeInTheDocument();
    expect(screen.queryByText('Bruno Santos')).not.toBeInTheDocument();
  });

  it('opens the picker and lists every member when the + button is clicked', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Adicionar responsável' }));

    expect(screen.getByRole('button', { name: 'Responsável Ana Costa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Responsável Bruno Santos' })).toBeInTheDocument();
  });

  it('adds a second assignee from the picker and saves both ids', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Adicionar responsável' }));
    await user.click(screen.getByRole('button', { name: 'Responsável Bruno Santos' }));

    expect(screen.getAllByText('Bruno Santos').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ assignee_ids: expect.arrayContaining([1, 2]) })
    );
  });

  it('removes an assignee via its chip button', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Remover Ana Costa do cartão' }));
    expect(screen.queryByText('Ana Costa')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ assignee_ids: [] }));
  });

  it('toggles a colour label on and includes it on save', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Etiqueta green' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ labels: ['green'] }));
  });

  it('disables saving when the title is cleared', async () => {
    const user = userEvent.setup();
    renderModal();

    const titleInput = screen.getByLabelText('Título');
    await user.clear(titleInput);

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('toggles a colour label off again when clicked twice', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    const swatch = screen.getByRole('button', { name: 'Etiqueta green' });
    await user.click(swatch);
    await user.click(swatch);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ labels: [] }));
  });

  it('saves the newly selected column and priority', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await user.selectOptions(screen.getByLabelText('Coluna'), '2');
    await user.selectOptions(screen.getByLabelText('Prioridade'), 'high');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ column_id: 2, priority: 'high' }));
  });

  it('calls onDelete with the task when Eliminar is clicked', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(onDelete).toHaveBeenCalledWith(baseTask);
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the overlay behind the modal is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole('dialog'));

    expect(onClose).toHaveBeenCalled();
  });
});
