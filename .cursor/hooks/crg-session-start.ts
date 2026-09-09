import { consumeStdin, runCrg, writeJson } from "./crg.ts";

consumeStdin();
const msg = runCrg(["status"]) || "graph not built yet";
writeJson({ passed: true, additional_context: msg });
