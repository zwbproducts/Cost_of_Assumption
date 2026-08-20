import { describe, it, expect } from "bun:test";
import { packetToCsv } from "../csv";
import { createStore } from "../store";
import { loadConfig } from "../config";
import { buildTestConfig } from "../scenario";
import { runSimulation } from "../simulation";
import type { Classification } from "../types";

describe("evidence packet CSV export", () => {
  it("includes the record classification columns", async () => {
    const s = createStore({ persist: false });
    const config = buildTestConfig(loadConfig());
    s.initFromConfig(config);
    const sim = runSimulation(config);
    for (const e of sim.events) await s.appendEvent(e.type, e.payload, e.ts);
    await s.setAgent(sim.agent);
    await s.setOnChain(sim.onChain);
    await s.setDivergence(sim.divergence);
    await s.setControlAnalysis(sim.controlAnalysis);
    await s.setRecovery(sim.recovery);
    const classification: Classification = {
      result: "contradicted",
      reason: "agent exceeded expected amount",
      uncertainty: "",
      alternative: "",
      nextControl: "",
      by: "reviewer",
      at: new Date().toISOString(),
    };
    await s.setClassification(classification);

    const csv = packetToCsv(s.buildPacket());
    const header = csv.split("\n")[0];
    expect(header).toContain("classification.result");
    expect(header).toContain("classification.by");
    expect(csv).toContain("contradicted");
    expect(csv).toContain("reviewer");
    // valid CSV: same number of cells in header and data row
    const countCells = (line: string): number => {
      let cells = 0;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') i++;
          else inQuotes = !inQuotes;
        } else if (c === "," && !inQuotes) {
          cells++;
        }
      }
      return cells + 1;
    };
    const lines = csv.split("\n");
    const headerCells = countCells(lines[0]);
    const dataCells = countCells(lines[1]);
    expect(dataCells).toBe(headerCells);
  });
});
