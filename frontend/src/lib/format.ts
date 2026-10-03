/** Shortens a Stellar address to its first 6 and last 4 characters. */
export function truncateAddress(address: string): string {
  if (address.length <= 10) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
