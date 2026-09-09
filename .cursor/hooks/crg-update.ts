import { consumeStdin, runCrg, writeJson } from "./crg.ts";

consumeStdin();
runCrg(["update", "--skip-flows"]);
writeJson({ passed: true });
