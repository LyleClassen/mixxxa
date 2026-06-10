// Public API of the track-table feature. App renders the switch + toggle and
// reads the persisted mode; the individual table implementations and column
// metadata are internal details imported directly by sibling modules.
export {
  TrackTableSwitch,
  TrackTableModeToggle,
  useTrackTableMode,
  type TrackTableMode,
} from "./TrackTableSwitch";
