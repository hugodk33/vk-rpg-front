const fs = require("fs");
const p = "components/location/locAtlas.tsx";
const s = fs.readFileSync(p, "utf8");
const start = s.indexOf("CurrentMapStrip({");
if (start < 0) process.exit(0);
let i = start,
  depth = 0,
  inStr = false,
  quote = "";
while (i < s.length) {
  const c = s[i];
  if (inStr) {
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === quote) {
      inStr = false;
      quote = "";
    }
  } else {
    if (c === '"' || c === "'") {
      inStr = true;
      quote = c;
    } else if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  i++;
}
const block = s.slice(start, i);
const idx = block.indexOf("onPlanet");
if (idx >= 0) {
  console.log(block.slice(Math.max(0, idx - 200), idx + 320));
}
