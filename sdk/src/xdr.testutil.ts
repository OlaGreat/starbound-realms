import { scValToNative, xdr } from '@stellar/stellar-sdk';

/**
 * Returns the decoded arguments of a built contract-call operation.
 * stellar-sdk 17 represents XDR as plain data (op.body.invokeHostFunctionOp...),
 * not the method accessors (op.body().invokeHostFunctionOp()...) of earlier versions.
 */
export function decodeInvokeArgs(operation: xdr.Operation): unknown[] {
  const { args } = (operation as any).body.invokeHostFunctionOp.hostFunction.invokeContract;
  return args.map((arg: xdr.ScVal) => scValToNative(arg));
}
