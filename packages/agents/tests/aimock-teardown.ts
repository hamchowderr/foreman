export default async function teardown() {
  const mock = (globalThis as Record<string, unknown>).__aimock as
    | { stop(): Promise<void> }
    | undefined;
  if (mock) {
    await mock.stop();
  }
}
