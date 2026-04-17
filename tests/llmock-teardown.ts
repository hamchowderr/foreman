import { mock } from "./llmock-setup";

export default async function teardown() {
  await mock.stop();
}
