import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Fleet as FleetComponent } from './Fleet';
import { Fleet } from '@starbound-realms/sdk';

function makeFleet(overrides: Partial<Fleet> = {}): Fleet {
  return { scouts: 0, fighters: 0, cruisers: 0, dreadnoughts: 0, location: 0, lastMoved: 0, ...overrides };
}

describe('Fleet', () => {
  it('renders nothing when there is no fleet data', () => {
    const { container } = render(<FleetComponent fleet={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows each unit type count', () => {
    render(<FleetComponent fleet={makeFleet({ scouts: 3, fighters: 2, cruisers: 1, dreadnoughts: 0 })} />);

    expect(screen.getByText(/Scouts/)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows total attack and defense matching the SDK formulas', () => {
    // 2 fighters: attack 5*2=10, defense 3*2=6
    render(<FleetComponent fleet={makeFleet({ fighters: 2 })} />);

    expect(screen.getByText(/Attack/)).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText(/Defense/)).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('does not show a build form when no onBuildUnit handler is given', () => {
    render(<FleetComponent fleet={makeFleet()} />);

    expect(screen.queryByRole('button', { name: /build/i })).not.toBeInTheDocument();
  });

  it('shows the iron/energy cost for the selected unit type', () => {
    render(<FleetComponent fleet={makeFleet()} onBuildUnit={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/unit type/i), { target: { value: 'Cruiser' } });

    expect(screen.getByText(/60 Iron/)).toBeInTheDocument();
    expect(screen.getByText(/40 Energy/)).toBeInTheDocument();
  });

  it('scales the displayed cost by the entered count', () => {
    render(<FleetComponent fleet={makeFleet()} onBuildUnit={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/unit type/i), { target: { value: 'Cruiser' } });
    fireEvent.change(screen.getByLabelText(/count/i), { target: { value: '3' } });

    expect(screen.getByText(/180 Iron/)).toBeInTheDocument();
    expect(screen.getByText(/120 Energy/)).toBeInTheDocument();
  });

  it('clamps the count input to a minimum of 1', () => {
    const onBuildUnit = vi.fn();
    render(<FleetComponent fleet={makeFleet()} onBuildUnit={onBuildUnit} />);

    fireEvent.change(screen.getByLabelText(/count/i), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /build/i }));

    expect(onBuildUnit).toHaveBeenCalledWith('Scout', 1);
  });

  it('calls onBuildUnit with the selected unit type and count', () => {
    const onBuildUnit = vi.fn();
    render(<FleetComponent fleet={makeFleet()} onBuildUnit={onBuildUnit} />);

    fireEvent.change(screen.getByLabelText(/unit type/i), { target: { value: 'Fighter' } });
    fireEvent.change(screen.getByLabelText(/count/i), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: /build/i }));

    expect(onBuildUnit).toHaveBeenCalledWith('Fighter', 4);
  });

  it('defaults to building a count of 1', () => {
    const onBuildUnit = vi.fn();
    render(<FleetComponent fleet={makeFleet()} onBuildUnit={onBuildUnit} />);

    fireEvent.click(screen.getByRole('button', { name: /build/i }));

    expect(onBuildUnit).toHaveBeenCalledWith('Scout', 1);
  });
});
