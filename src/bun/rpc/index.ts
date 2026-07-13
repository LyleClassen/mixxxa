import { dialogsHandlers } from "./dialogs";
import { rekordboxHandlers } from "./rekordbox";
import { writeBackHandlers } from "./rekordbox-writeback";
import { analysisHandlers } from "./analysis";
import { waveformHandlers } from "./waveform";
import { cuesHandlers } from "./cues";
import { identifyHandlers } from "./identify";

export const rpcHandlers = {
  requests: {
    ...dialogsHandlers,
    ...rekordboxHandlers,
    ...writeBackHandlers,
    ...analysisHandlers,
    ...waveformHandlers,
    ...cuesHandlers,
    ...identifyHandlers,
  },
  messages: {},
};
