/** Reusable test assertion: foreign tenant resources must look absent, never forbidden. */
export async function expectCrossTenantNotFound(request: () => Promise<{ status: number }>): Promise<void> {
  const response = await request();
  if (response.status !== 404) throw new Error(`Expected cross-tenant request to return 404, received ${response.status}.`);
}
