// @ts-nocheck
import * as __fd_glob_30 from "../content/docs/core-concepts/workflows.mdx?collection=docs"
import * as __fd_glob_29 from "../content/docs/core-concepts/voice.mdx?collection=docs"
import * as __fd_glob_28 from "../content/docs/core-concepts/tool-discovery.mdx?collection=docs"
import * as __fd_glob_27 from "../content/docs/core-concepts/memory.mdx?collection=docs"
import * as __fd_glob_26 from "../content/docs/core-concepts/index.mdx?collection=docs"
import * as __fd_glob_25 from "../content/docs/core-concepts/guardrails.mdx?collection=docs"
import * as __fd_glob_24 from "../content/docs/core-concepts/approvals.mdx?collection=docs"
import * as __fd_glob_23 from "../content/docs/integrations/mcp-self-hosted.mdx?collection=docs"
import * as __fd_glob_22 from "../content/docs/integrations/mcp-cloud.mdx?collection=docs"
import * as __fd_glob_21 from "../content/docs/integrations/index.mdx?collection=docs"
import * as __fd_glob_20 from "../content/docs/integrations/a2a-self-hosted.mdx?collection=docs"
import * as __fd_glob_19 from "../content/docs/integrations/a2a-cloud.mdx?collection=docs"
import * as __fd_glob_18 from "../content/docs/architecture/zapier-sdk.mdx?collection=docs"
import * as __fd_glob_17 from "../content/docs/architecture/streaming.mdx?collection=docs"
import * as __fd_glob_16 from "../content/docs/architecture/mastra.mdx?collection=docs"
import * as __fd_glob_15 from "../content/docs/architecture/index.mdx?collection=docs"
import * as __fd_glob_14 from "../content/docs/channels/telegram.mdx?collection=docs"
import * as __fd_glob_13 from "../content/docs/channels/slack.mdx?collection=docs"
import * as __fd_glob_12 from "../content/docs/channels/linear.mdx?collection=docs"
import * as __fd_glob_11 from "../content/docs/channels/index.mdx?collection=docs"
import * as __fd_glob_10 from "../content/docs/channels/google-chat.mdx?collection=docs"
import * as __fd_glob_9 from "../content/docs/channels/github.mdx?collection=docs"
import * as __fd_glob_8 from "../content/docs/channels/discord.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/self-hosting.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/index.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/getting-started.mdx?collection=docs"
import { default as __fd_glob_4 } from "../content/docs/architecture/meta.json?collection=docs"
import { default as __fd_glob_3 } from "../content/docs/integrations/meta.json?collection=docs"
import { default as __fd_glob_2 } from "../content/docs/channels/meta.json?collection=docs"
import { default as __fd_glob_1 } from "../content/docs/core-concepts/meta.json?collection=docs"
import { default as __fd_glob_0 } from "../content/docs/meta.json?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content/docs", {"meta.json": __fd_glob_0, "core-concepts/meta.json": __fd_glob_1, "channels/meta.json": __fd_glob_2, "integrations/meta.json": __fd_glob_3, "architecture/meta.json": __fd_glob_4, }, {"getting-started.mdx": __fd_glob_5, "index.mdx": __fd_glob_6, "self-hosting.mdx": __fd_glob_7, "channels/discord.mdx": __fd_glob_8, "channels/github.mdx": __fd_glob_9, "channels/google-chat.mdx": __fd_glob_10, "channels/index.mdx": __fd_glob_11, "channels/linear.mdx": __fd_glob_12, "channels/slack.mdx": __fd_glob_13, "channels/telegram.mdx": __fd_glob_14, "architecture/index.mdx": __fd_glob_15, "architecture/mastra.mdx": __fd_glob_16, "architecture/streaming.mdx": __fd_glob_17, "architecture/zapier-sdk.mdx": __fd_glob_18, "integrations/a2a-cloud.mdx": __fd_glob_19, "integrations/a2a-self-hosted.mdx": __fd_glob_20, "integrations/index.mdx": __fd_glob_21, "integrations/mcp-cloud.mdx": __fd_glob_22, "integrations/mcp-self-hosted.mdx": __fd_glob_23, "core-concepts/approvals.mdx": __fd_glob_24, "core-concepts/guardrails.mdx": __fd_glob_25, "core-concepts/index.mdx": __fd_glob_26, "core-concepts/memory.mdx": __fd_glob_27, "core-concepts/tool-discovery.mdx": __fd_glob_28, "core-concepts/voice.mdx": __fd_glob_29, "core-concepts/workflows.mdx": __fd_glob_30, });