import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPanel } from './SettingsPanel';

describe('SettingsPanel', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    localStorage.clear();
    mockOnClose.mockClear();
  });

  it('renders settings panel with all sections', () => {
    render(<SettingsPanel onClose={mockOnClose} networkLabel="Testnet" />);

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Audio')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('closes when close button is clicked', () => {
    render(<SettingsPanel onClose={mockOnClose} networkLabel="Testnet" />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes when overlay is clicked', () => {
    render(<SettingsPanel onClose={mockOnClose} networkLabel="Testnet" />);

    const overlay = screen.getByRole('dialog').parentElement;
    if (overlay) {
      fireEvent.click(overlay);
    }

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('displays network label when provided', () => {
    render(<SettingsPanel onClose={mockOnClose} networkLabel="Mainnet" />);

    expect(screen.getByText('Connected to Stellar Mainnet')).toBeInTheDocument();
  });

  it('toggles sound setting', () => {
    render(<SettingsPanel onClose={mockOnClose} networkLabel="Testnet" />);

    const soundToggle = screen.getByRole('button', { name: /sound/i });
    fireEvent.click(soundToggle);

    expect(localStorage.getItem('starbound-preferences')).toContain('soundEnabled');
  });
});
