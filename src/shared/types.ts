import type { RPCSchema } from "electrobun/bun";
import type { DjmdContent } from "rbox-js";

export type MixxxRPC = {
  bun: RPCSchema<{
    requests: {
      openXmlFile: { params: undefined; response: string | null };
      getContents: { params: undefined; response: DjmdContent[] };
    };
    messages: {};
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {};
  }>;
};
