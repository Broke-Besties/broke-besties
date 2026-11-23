import packageJson from "../package.json" with { type: "json" };

export const packageVersion = packageJson.version;
