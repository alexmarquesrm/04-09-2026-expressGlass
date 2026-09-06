import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskForm from './TaskForm.jsx';

describe('TaskForm', () => {
  it('does not call onCreate when the title is empty', async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<TaskForm onCreate={onCreate} />);

    await user.click(screen.getByRole('button', { name: 'Adicionar tarefa' }));

    expect(onCreate).not.toHaveBeenCalled();
  });

  it('submits the trimmed title, priority and due date, then clears the form', async () => {
    const onCreate = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();
    render(<TaskForm onCreate={onCreate} />);

    await user.type(screen.getByPlaceholderText('O que precisa de ser feito?'), '  Comprar leite  ');
    await user.selectOptions(screen.getByRole('combobox'), 'high');
    await user.type(screen.getByPlaceholderText('Notas (opcional)'), 'lembrar do desconto');
    const dueDateInput = document.querySelector('input[type="date"]');
    await user.type(dueDateInput, '2026-12-01');
    await user.click(screen.getByRole('button', { name: 'Adicionar tarefa' }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith({
      title: 'Comprar leite',
      description: 'lembrar do desconto',
      priority: 'high',
      due_date: '2026-12-01',
    });

    await waitFor(() => expect(screen.getByPlaceholderText('O que precisa de ser feito?')).toHaveValue(''));
    expect(screen.getByPlaceholderText('Notas (opcional)')).toHaveValue('');
    expect(dueDateInput).toHaveValue('');
  });

  it('disables the submit button while the create request is pending', async () => {
    let resolveCreate;
    const onCreate = vi.fn(() => new Promise((resolve) => { resolveCreate = resolve; }));
    const user = userEvent.setup();
    render(<TaskForm onCreate={onCreate} />);

    await user.type(screen.getByPlaceholderText('O que precisa de ser feito?'), 'Tarefa lenta');
    await user.click(screen.getByRole('button', { name: 'Adicionar tarefa' }));

    expect(screen.getByRole('button', { name: 'Adicionar tarefa' })).toBeDisabled();
    resolveCreate({});
    await waitFor(() => expect(screen.getByRole('button', { name: 'Adicionar tarefa' })).not.toBeDisabled());
  });

  it('keeps the draft in place when onCreate rejects', async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error('falhou'));
    const user = userEvent.setup();
    render(<TaskForm onCreate={onCreate} />);

    await user.type(screen.getByPlaceholderText('O que precisa de ser feito?'), 'Título que fica');
    await user.click(screen.getByRole('button', { name: 'Adicionar tarefa' }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(screen.getByPlaceholderText('O que precisa de ser feito?')).toHaveValue('Título que fica');
  });
});
