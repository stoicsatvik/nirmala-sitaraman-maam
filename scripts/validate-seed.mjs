import { readFile } from "node:fs/promises";

const file = await readFile(new URL("../src/data/seed.ts", import.meta.url), "utf8");
const matches = [...file.matchAll(/paisePerRupee:\s*(\d+(?:\.\d+)?)/g)];
const values = matches.map((match) => Number(match[1]));
const total = values.reduce((sum, value) => sum + value, 0);

if (values.length !== 9) {
  throw new Error(`Expected 9 official Rupee Goes To categories, found ${values.length}`);
}

if (total !== 100) {
  throw new Error(`Expected allocation total of 100 paise, got ${total}`);
}

const requiredSourceIds = [
  "budget-glance-2026",
  "expenditure-profile-2026",
  "receipt-budget-2026"
];

for (const id of requiredSourceIds) {
  if (!file.includes(`id: "${id}"`)) {
    throw new Error(`Missing source ${id}`);
  }
}

console.log(`Seed validation passed: ${values.length} categories, ${total} paise, ${requiredSourceIds.length} primary sources.`);
