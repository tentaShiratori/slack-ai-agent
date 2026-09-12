export type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

function serviceName(): string {
  return process.env.SERVICE_NAME ?? process.env.K_SERVICE ?? "app";
}

export function errorFields(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
    };
  }
  return { errorMessage: String(error) };
}

export function log(
  severity: Severity,
  message: string,
  fields: Record<string, unknown> = {},
): string {
  const entry = {
    ...fields,
    severity,
    message,
    timestamp: new Date().toISOString(),
    service: serviceName(),
  };

  let line: string;
  let outSeverity: Severity = severity;
  try {
    line = JSON.stringify(entry);
  } catch {
    outSeverity = "ERROR";
    line = JSON.stringify({
      severity: "ERROR",
      message: "failed to serialize log entry",
      originalMessage: message,
      timestamp: new Date().toISOString(),
      service: serviceName(),
    });
  }

  if (outSeverity === "ERROR" || outSeverity === "CRITICAL") {
    console.error(line);
  } else {
    console.log(line);
  }
  return line;
}
