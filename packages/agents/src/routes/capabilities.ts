import { Hono } from "hono";
import { CAPABILITIES, getCapabilities, setCapability } from "../lib/capabilities";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";

const capabilities = new Hono<AppEnv>();

// All routes require auth
capabilities.use("/*", authMiddleware);

// GET / — list current user's capabilities
capabilities.get("/", async (c) => {
  const userId = c.get("userId");
  const caps = await getCapabilities(userId);
  return c.json({ capabilities: caps });
});

// PUT /:capability — set a capability flag
capabilities.put("/:capability", async (c) => {
  const userId = c.get("userId");
  const capability = c.req.param("capability");

  // Validate capability name
  if (!CAPABILITIES.includes(capability as any)) {
    return c.json({ error: `Unknown capability: ${capability}` }, 400);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (typeof body.enabled !== "boolean") {
    return c.json({ error: "enabled (boolean) is required" }, 400);
  }

  await setCapability(userId, capability, body.enabled);

  return c.json({ capability, enabled: body.enabled });
});

export default capabilities;
