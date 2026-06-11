import { dialogsHandlers } from "./dialogs";
import { rekordboxHandlers } from "./rekordbox";
import { analysisHandlers } from "./analysis";
import { waveformHandlers } from "./waveform";

export const rpcHandlers = {
  requests: {
    ...dialogsHandlers,
    ...rekordboxHandlers,
    ...analysisHandlers,
    ...waveformHandlers,
  },
  messages: {},
};
