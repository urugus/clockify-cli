import { describe, expect, it, vi } from "vitest";
import {
  buildReadApiKeyCommand,
  buildSaveApiKeyCommand,
  keychainAccount,
  readApiKey,
  saveApiKey,
} from "../../src/keychain/keychain.js";

describe("keychain", () => {
  it("builds keychain account names", () => {
    expect(keychainAccount("default")).toBe("default:api-key");
  });

  it("builds save and read commands", () => {
    expect(buildSaveApiKeyCommand("default", "secret")).toEqual({
      file: "/usr/bin/security",
      args: [
        "add-generic-password",
        "-a",
        "default:api-key",
        "-s",
        "clockify-cli",
        "-w",
        "secret",
        "-U",
      ],
    });
    expect(buildReadApiKeyCommand("default")).toEqual({
      file: "/usr/bin/security",
      args: ["find-generic-password", "-a", "default:api-key", "-s", "clockify-cli", "-w"],
    });
  });

  it("saves API keys through injected exec", async () => {
    const execImpl = vi.fn().mockResolvedValue({ stdout: "" });

    const result = await saveApiKey("default", "secret", execImpl);

    expect(result.isOk()).toBe(true);
    expect(execImpl).toHaveBeenCalledWith(
      "/usr/bin/security",
      expect.arrayContaining(["add-generic-password", "-w", "secret"]),
    );
  });

  it("reads API keys through injected exec", async () => {
    const execImpl = vi.fn().mockResolvedValue({ stdout: "secret\n" });

    const result = await readApiKey("default", execImpl);

    expect(result.value).toBe("secret");
  });

  it("maps exec failures to keychain errors", async () => {
    const execImpl = vi.fn().mockRejectedValue(new Error("no keychain"));

    const saveResult = await saveApiKey("default", "secret", execImpl);
    const readResult = await readApiKey("default", execImpl);

    expect(saveResult._unsafeUnwrapErr().code).toBe("keychain_failed");
    expect(readResult._unsafeUnwrapErr().code).toBe("keychain_failed");
  });
});
