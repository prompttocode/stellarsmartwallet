const IOS_ALLOWED_STELLAR_OPERATIONS = new Set([
  'changeTrust',
  'createAccount',
  'payment',
]);

export function isWalletConnectOperationAllowed(operation: { type: string }) {
  return IOS_ALLOWED_STELLAR_OPERATIONS.has(operation.type);
}
