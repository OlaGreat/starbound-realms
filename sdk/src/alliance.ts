import { Contract, nativeToScVal } from '@stellar/stellar-sdk';
import { StarboundClient, TransactionSigner } from './client.js';

/**
 * SDK client for the alliance Soroban contract.
 *
 * Follow the same pattern as GalaxyClient, with:
 * - read methods using simulateReadCall(...)
 * - write methods using submitTransaction(...)
 * - contract id from this.client.contractIds
 */
export class AllianceClient {
  constructor(private readonly client: StarboundClient) {}

  async createAlliance(
    playerAddress: string,
    allianceName: string,
    sign: TransactionSigner
  ): Promise<void> {
    const contract = new Contract(this.client.contractIds.alliance);
    await this.client.submitTransaction({
      sourceAddress: playerAddress,
      operation: contract.call(
        'create_alliance',
        nativeToScVal(playerAddress, { type: 'address' }),
        nativeToScVal(allianceName, { type: 'string' })
      ),
      sign,
    });
  }

  async joinAlliance(
    playerAddress: string,
    allianceId: string,
    sign: TransactionSigner
  ): Promise<void> {
    const contract = new Contract(this.client.contractIds.alliance);
    await this.client.submitTransaction({
      sourceAddress: playerAddress,
      operation: contract.call(
        'join_alliance',
        nativeToScVal(playerAddress, { type: 'address' }),
        nativeToScVal(allianceId, { type: 'string' })
      ),
      sign,
    });
  }

  async leaveAlliance(
    playerAddress: string,
    allianceId: string,
    sign: TransactionSigner
  ): Promise<void> {
    const contract = new Contract(this.client.contractIds.alliance);
    await this.client.submitTransaction({
      sourceAddress: playerAddress,
      operation: contract.call(
        'leave_alliance',
        nativeToScVal(playerAddress, { type: 'address' }),
        nativeToScVal(allianceId, { type: 'string' })
      ),
      sign,
    });
  }

  async getAlliance(allianceId: string): Promise<any> {
    return this.client.simulateReadCall(this.client.contractIds.alliance, 'get_alliance', [
      nativeToScVal(allianceId, { type: 'string' }),
    ]);
  }
}
