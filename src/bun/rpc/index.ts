import { dialogsHandlers } from "./dialogs";
import { rekordboxHandlers } from "./rekordbox";

export const rpcHandlers = {
  requests: {
    ...dialogsHandlers,
    ...rekordboxHandlers,
  },
  messages: {},
};
