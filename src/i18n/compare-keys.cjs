/* global console, process, __dirname */
/**
 * Compare translation keys across all locale files.
 * Run periodically to ensure all language files have the same attributes.
 *
 * Usage: node src/i18n/compare-keys.cjs
 */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "locales");
const files = fs.readdirSync(dir).filter(function (f) {
  return f.endsWith(".json");
});

function getKeys(obj, prefix) {
  prefix = prefix || "";
  var keys = [];
  var entries = Object.keys(obj);
  for (var i = 0; i < entries.length; i++) {
    var k = entries[i];
    var fullPath = prefix ? prefix + "." + k : k;
    var v = obj[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys = keys.concat(getKeys(v, fullPath));
    } else {
      keys.push(fullPath);
    }
  }
  return keys;
}

function checkDuplicateKeys(jsonString) {
  // Parse JSON manually tracking duplicate keys at each nesting level
  var issues = [];
  var lines = jsonString.split("\n");
  var keyStack = [{}]; // stack of seen-keys sets per nesting level

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.trim();

    if (trimmed === "{") {
      keyStack.push({});
    } else if (trimmed === "}" || trimmed === "},") {
      keyStack.pop();
    } else {
      var match = trimmed.match(/^"([^"]+)"\s*:/);
      if (match) {
        var key = match[1];
        var currentLevel = keyStack[keyStack.length - 1];
        if (currentLevel[key]) {
          issues.push(
            "  DUPLICATE key \"" +
              key +
              "\" at line " +
              (i + 1) +
              " (first seen at line " +
              currentLevel[key] +
              ")"
          );
        }
        currentLevel[key] = i + 1;

        // If this key opens an object, push a new level
        if (trimmed.endsWith("{")) {
          keyStack.push({});
        }
      }
    }
  }

  return issues;
}

var allKeysByFile = {};
var allKeysSet = {};
var hasErrors = false;

console.log("Checking " + files.length + " locale files in " + dir + "\n");

// Check for duplicate keys first
for (var di = 0; di < files.length; di++) {
  var df = files[di];
  var raw = fs.readFileSync(path.join(dir, df), "utf8");
  var dupes = checkDuplicateKeys(raw);
  if (dupes.length > 0) {
    console.log("DUPLICATE KEYS in " + df + ":");
    for (var dj = 0; dj < dupes.length; dj++) {
      console.log(dupes[dj]);
    }
    console.log("");
    hasErrors = true;
  }
}

// Extract and compare leaf keys
for (var ei = 0; ei < files.length; ei++) {
  var ef = files[ei];
  var data = JSON.parse(fs.readFileSync(path.join(dir, ef), "utf8"));
  var keys = getKeys(data);
  allKeysByFile[ef] = {};
  for (var ki = 0; ki < keys.length; ki++) {
    allKeysByFile[ef][keys[ki]] = true;
    allKeysSet[keys[ki]] = true;
  }
}

var allKeys = Object.keys(allKeysSet).sort();

console.log("Total unique leaf keys across all files: " + allKeys.length + "\n");

for (var mi = 0; mi < files.length; mi++) {
  var mf = files[mi];
  var missing = [];
  for (var mki = 0; mki < allKeys.length; mki++) {
    if (!allKeysByFile[mf][allKeys[mki]]) {
      missing.push(allKeys[mki]);
    }
  }
  if (missing.length > 0) {
    console.log("MISSING from " + mf + " (" + missing.length + " keys):");
    for (var pi = 0; pi < missing.length; pi++) {
      console.log("  " + missing[pi]);
    }
    console.log("");
    hasErrors = true;
  } else {
    console.log(mf + ": COMPLETE (" + Object.keys(allKeysByFile[mf]).length + " keys)");
  }
}

if (hasErrors) {
  console.log("\nIssues found. Please fix the locale files.");
  process.exit(1);
} else {
  console.log("\nAll locale files are in sync.");
  process.exit(0);
}
