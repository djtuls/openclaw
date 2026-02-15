import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ExecResult = {
  stdout: string;
  stderr: string;
  error?: Error;
};

/**
 * Execute a command without throwing on non-zero exit codes.
 * Useful for commands where failures are expected and should be handled gracefully.
 *
 * @param command - Command to execute
 * @param args - Command arguments
 * @param options - Execution options (timeout, cwd, etc.)
 * @returns Result object with stdout, stderr, and optional error
 */
export async function execFileNoThrow(
  command: string,
  args: string[] = [],
  options: { timeout?: number; cwd?: string; maxBuffer?: number } = {},
): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      ...options,
      encoding: "utf8",
    });
    return { stdout, stderr };
  } catch (error: any) {
    // Return the error along with any output that was captured
    return {
      stdout: error.stdout || "",
      stderr: error.stderr || "",
      error: error,
    };
  }
}
