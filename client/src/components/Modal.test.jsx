import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './ui';

function renderModal() {
  const onClose = vi.fn();
  render(
    <Modal open title="تعديل" onClose={onClose}>
      <input aria-label="الاسم" />
    </Modal>
  );
  return onClose;
}

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(<Modal open={false} title="x" onClose={() => {}} />);
    expect(screen.queryByText('x')).toBeNull();
  });

  it('does not close when clicking inside the dialog', () => {
    const onClose = renderModal();
    fireEvent.click(screen.getByLabelText('الاسم'));
    fireEvent.click(screen.getByText('تعديل'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on backdrop click, the × button, and Escape', () => {
    const onClose = renderModal();
    fireEvent.click(screen.getByRole('presentation'));
    fireEvent.click(screen.getByRole('button', { name: '×' }));
    fireEvent.keyDown(screen.getByLabelText('الاسم'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
