import { describe, it, expect } from 'vitest';
import { buildStarboundClientConfig } from './starboundClient';

function validEnv(): Record<string, string | undefined> {
  return {
    VITE_SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
    VITE_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
    VITE_CONTRACT_GALAXY_MAP: 'CGALAXY',
    VITE_CONTRACT_RESOURCES: 'CRESOURCES',
    VITE_CONTRACT_FLEET: 'CFLEET',
    VITE_CONTRACT_BATTLE: 'CBATTLE',
  };
}

describe('buildStarboundClientConfig', () => {
  it('maps VITE_ env vars to a StarboundClientConfig', () => {
    const config = buildStarboundClientConfig(validEnv());

    expect(config).toEqual({
      rpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015',
      contractIds: {
        galaxyMap: 'CGALAXY',
        resources: 'CRESOURCES',
        fleet: 'CFLEET',
        battle: 'CBATTLE',
      },
    });
  });

  it('throws when a required var is set to an empty string, not just when absent', () => {
    const env = validEnv();
    env.VITE_CONTRACT_FLEET = '';

    expect(() => buildStarboundClientConfig(env)).toThrow(/VITE_CONTRACT_FLEET/);
  });

  it.each([
    'VITE_SOROBAN_RPC_URL',
    'VITE_NETWORK_PASSPHRASE',
    'VITE_CONTRACT_GALAXY_MAP',
    'VITE_CONTRACT_RESOURCES',
    'VITE_CONTRACT_FLEET',
    'VITE_CONTRACT_BATTLE',
  ])('throws a clear error when %s is missing', (key) => {
    const env = validEnv();
    delete env[key];

    expect(() => buildStarboundClientConfig(env)).toThrow(new RegExp(key));
  });
});
