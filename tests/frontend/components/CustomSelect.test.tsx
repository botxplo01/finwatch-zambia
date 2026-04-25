import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CustomSelect } from '@/components/ui/CustomSelect';

const options = [
  { value: 'opt1', label: 'Option 1' },
  { value: 'opt2', label: 'Option 2' },
];

describe('CustomSelect Component', () => {
  it('renders with placeholder when no value is selected', () => {
    render(<CustomSelect options={options} value="" onChange={vi.fn()} placeholder="Test Placeholder" />);
    expect(screen.getByText('Test Placeholder')).toBeInTheDocument();
  });

  it('renders the label of the selected option', () => {
    render(<CustomSelect options={options} value="opt1" onChange={vi.fn()} />);
    expect(screen.getByText('Option 1')).toBeInTheDocument();
  });

  it('opens the dropdown when clicked', () => {
    render(<CustomSelect options={options} value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  it('calls onChange when an option is clicked', () => {
    const onChange = vi.fn();
    render(<CustomSelect options={options} value="" onChange={onChange} />);
    
    // Open dropdown
    fireEvent.click(screen.getByRole('button'));
    
    // Click option 2
    fireEvent.click(screen.getByText('Option 2'));
    
    expect(onChange).toHaveBeenCalledWith('opt2');
  });

  it('closes the dropdown after selecting an option', () => {
    render(<CustomSelect options={options} value="" onChange={vi.fn()} />);
    
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Option 1'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument(); // Assuming logic closes it
  });
});
