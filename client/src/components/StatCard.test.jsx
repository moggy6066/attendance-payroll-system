import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatCard from './StatCard';

describe('StatCard', () => {
  it('renders title, value and trend with the requested tone', () => {
    const { container } = render(<StatCard title="الحاضرون" value={12} trend="+2" tone="green" />);
    expect(screen.getByText('الحاضرون')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('bg-green-50');
  });

  it('omits the trend when not given', () => {
    render(<StatCard title="الغائبون" value={0} />);
    expect(screen.queryByText('+2')).toBeNull();
  });
});
