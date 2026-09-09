import fs from "fs";
import path from "path";
import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { OpenAPIObjectConfig } from "@asteasolutions/zod-to-openapi/dist/v3.0/openapi-generator";
import { dump } from "js-yaml";
import { z } from "zod";

const appDir = path.join(import.meta.dir, "../api");
function digApiDir(dir = appDir): string[] {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  return files.flatMap((file) => {
    if (file.isDirectory()) {
      return digApiDir(path.join(dir, file.name));
    }
    return path.join(dir.replace(appDir, "/"), file.name);
  });
}

async function main() {
  const registry = new OpenAPIRegistry();
  const apis = digApiDir();
  for (const api of apis) {
    const apiPath = api.replace(".ts", "");
    registry.registerPath({
      method: "get",
      path: `/api${apiPath}`,
      request: {},
      responses: {
        200: {
          description: "Object with user data.",
          content: {
            "application/json": {
              schema: z.object({}),
            },
          },
        },
      },
    });
  }

  const generator = new OpenApiGeneratorV3(registry.definitions);
  const config: OpenAPIObjectConfig = {
    openapi: "hoge",
    info: {
      title: "All in oneの自分用スラックアプリ",
      version: "0.1.0",
    },
  };
  const docs = generator.generateDocument(config);
  fs.writeFileSync(path.join(import.meta.dir, "../openapi.yml"), dump(docs));
}

void main();
