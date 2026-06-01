import { Electroview } from "electrobun/view";
import type { MixxxRPC } from "../shared/types";

const rpc = Electroview.defineRPC<MixxxRPC>({
  maxRequestTime: Infinity,
  handlers: { requests: {}, messages: {} },
});

export const electroview = new Electroview({ rpc });
