window.DJMAX_REMOTE_CONFIG = {
  // Set your deployed Apps Script Web App URL
  apiUrl: "https://script.google.com/macros/s/REPLACE_ME/exec",
  // Must match READ_TOKEN in apps-script/Code.gs
  readToken: "change-this-read-token",
  // Must match WRITE_TOKEN in apps-script/Code.gs
  writeToken: "change-this-write-token",
  // "state" or "drive-file". "drive-file" reads songs/buttons/difficulties from djmax-song-catalog.json.
  catalogMode: "state",
  timeoutMs: 10000
};
