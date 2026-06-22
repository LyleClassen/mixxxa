import { dialogsHandlers } from "./dialogs";
import { rekordboxHandlers } from "./rekordbox";
import { writeBackHandlers } from "./rekordbox-writeback";
import { analysisHandlers } from "./analysis";
import { waveformHandlers } from "./waveform";
import { cuesHandlers } from "./cues";

export const rpcHandlers = {
  requests: {
    ...dialogsHandlers,
    ...rekordboxHandlers,
    ...writeBackHandlers,
    ...analysisHandlers,
    ...waveformHandlers,
    ...cuesHandlers,
  },
  messages: {},
};
