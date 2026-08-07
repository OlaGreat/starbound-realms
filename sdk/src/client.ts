import { Contract, Networks, rpc, TransactionBuilder, BASE_FEE } from '@stellar/stellar-sdk';

export interface ContractIds {
  galaxyMap: string;
  resources: string;
  fleet: string;
  battle: string;
}

export interface StarboundClientConfig {
  rpcUrl: string;
  networkPassphrase: string;
  contractIds: ContractIds;
}

export class StarboundClient {
  public readonly server: rpc.Server;
  public readonly networkPassphrase: string;
  public readonly contractIds: ContractIds;

  constructor(config: StarboundClientConfig) {
    this.server = new rpc.Server(config.rpcUrl, { allowHttp: false });
    this.networkPassphrase = config.networkPassphrase;
    this.contractIds = config.contractIds;
  }

  /** Returns a pre-configured testnet client. */
  static testnet(contractIds: ContractIds): StarboundClient {
    return new StarboundClient({
      rpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: Networks.TESTNET,
      contractIds,
    });
  }
}
