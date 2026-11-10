import { describe, it, expect } from 'vitest';
import { completerUserData } from '../../api/meta-capi.js';

describe('relais CAPI : clés de correspondance', () => {
  it('ajoute IP, navigateur et pays sans écraser ce qui existe', () => {
    const ud = completerUserData({ ph: ['abc'], fbp: 'fb.1.x' }, { ip: '105.1.2.3', ua: 'Mozilla/5.0' });
    expect(ud.client_ip_address).toBe('105.1.2.3');
    expect(ud.client_user_agent).toBe('Mozilla/5.0');
    expect(ud.country[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(ud.ph).toEqual(['abc']);
    expect(completerUserData({ client_user_agent: 'X' }, { ip: null, ua: 'Y' })).toMatchObject({ client_user_agent: 'X' });
    expect(completerUserData({}, { ip: null, ua: null }).client_ip_address).toBeUndefined();
  });
});
