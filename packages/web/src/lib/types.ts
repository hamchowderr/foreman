// App-native SSE chunk types sent to the client

export type AppChunk =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; toolName: string; args: Record<string, unknown> }
  | {
      type: "proposal-created";
      proposal: {
        id: string;
        app_key: string;
        action_type: string;
        action_key: string;
        human_label: string;
        inputs: Record<string, unknown>;
        input_schema: Record<string, unknown>;
        connection_id: string | null;
        status: string;
      };
    }
  | {
      type: "action-executed";
      proposalId: string;
      summary: string;
      result: unknown;
    }
  | {
      type: "error";
      code: string;
      message: string;
      proposalId?: string;
    }
  | { type: "title-updated"; title: string }
  | { type: "done"; runId: string };
