#!/usr/bin/env node
import { createProgram } from "./cli/program.js";

export const main = async (): Promise<void> => {
  const io = { stdout: process.stdout, stderr: process.stderr };
  await createProgram({ io }).parseAsync(process.argv);
};

await main();
