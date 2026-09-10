const fs = require("fs");
const path = require("path");

const databasePath = path.join(__dirname, "../system");
const warnFile = path.join(databasePath, "warn.json");

if (!fs.existsSync(databasePath)) {
  fs.mkdirSync(databasePath, { recursive: true });
}
if (!fs.existsSync(warnFile)) {
  fs.writeFileSync(warnFile, JSON.stringify({}));
}

function loadWarnings() {
  try {
    return JSON.parse(fs.readFileSync(warnFile, "utf-8"));
  } catch {
    return {};
  }
}

function saveWarnings(data) {
  fs.writeFileSync(warnFile, JSON.stringify(data, null, 2));
}

module.exports = { loadWarnings, saveWarnings };