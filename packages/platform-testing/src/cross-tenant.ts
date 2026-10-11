/**
 * Ensures a resource owned by another celebration is indistinguishable from an
 * absent resource. Consumers only need to pass their request function.
 */
export async function expectCrossTenantNotFound(request: () => Promise<{ status: number }>): Promise<void> {
  const response = await request();
  if (response.status !== 404) {
    throw new Error(`Cross-tenant resource disclosure: expected 404, received ${response.status}.`);
  }
}
