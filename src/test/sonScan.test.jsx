import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
vi.mock('../components/Toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
import { lireReglagesSon, jouerBip, jouerErreur, CLE_SON_SCAN } from '../lib/beep';
import SonScanReglages from '../components/settings/SonScanReglages';

describe('son du scan', () => {
  beforeEach(() => localStorage.clear());

  it('valeurs par défaut puis réglage gardé', () => {
    expect(lireReglagesSon()).toMatchObject({ actif: true, volume: 80, succes: 'classique', erreur: 'grave' });
    render(<SonScanReglages />);
    fireEvent.click(screen.getByText('Ding'));
    fireEvent.click(screen.getByText('Buzzer'));
    expect(JSON.parse(localStorage.getItem(CLE_SON_SCAN))).toMatchObject({ succes: 'ding', erreur: 'buzzer' });
  });

  it('son coupé : vibre quand même, sans jamais planter', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    localStorage.setItem(CLE_SON_SCAN, JSON.stringify({ actif: false }));
    expect(() => { jouerBip(); jouerErreur(); }).not.toThrow();
    expect(vibrate).toHaveBeenCalledTimes(2);
  });
});
