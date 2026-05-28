import type { RPCSchema } from "electrobun/bun";

export type MixxxRPC = {
  bun: RPCSchema<{
    requests: {
      openXmlFile: { params: undefined; response: string | null };
    };
    messages: {};
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {};
  }>;
};
