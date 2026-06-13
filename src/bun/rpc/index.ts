import { dialogsHandlers } from "./dialogs";
import { rekordboxHandlers } from "./rekordbox";
import { analysisHandlers } from "./analysis";
import { waveformHandlers } from "./waveform";
import { cuesHandlers } from "./cues";

export const rpcHandlers = {
  requests: {
    ...dialogsHandlers,
    ...rekordboxHandlers,
    ...analysisHandlers,
    ...waveformHandlers,
    ...cuesHandlers,
  },
  messages: {},
};
