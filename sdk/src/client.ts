import {
  Account,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';

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

  /**
   * Simulates a read-only contract call and returns its decoded native
   * result. Never submits a transaction — no account needs to be funded.
   */
  async simulateReadCall(contractId: string, method: string, args: xdr.ScVal[] = []): Promise<any> {
    const tx = buildReadCallTransaction(this.networkPassphrase, contractId, method, args);
    const simulation = await this.server.simulateTransaction(tx);
    return decodeSimulationResult(method, simulation);
  }
}

/** Builds a throwaway, never-submitted transaction for simulating a read call. */
function buildReadCallTransaction(
  networkPassphrase: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[]
): ReturnType<TransactionBuilder['build']> {
  const contract = new Contract(contractId);
  // Simulation doesn't touch this account's balance or require its signature,
  // so a fresh throwaway keypair is enough — no funded account needed.
  const readOnlySource = new Account(Keypair.random().publicKey(), '0');

  return new TransactionBuilder(readOnlySource, { fee: BASE_FEE, networkPassphrase })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();
}

/** Extracts and decodes a simulated read call's return value, or throws its error. */
function decodeSimulationResult(method: string, simulation: rpc.Api.SimulateTransactionResponse): any {
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`${method}: simulation failed — ${simulation.error}`);
  }
  if (!simulation.result) {
    throw new Error(`${method}: simulation returned no result`);
  }
  return scValToNative(simulation.result.retval);
}
