import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@clack/prompts");
vi.mock("../../src/templates.js");
vi.mock("../../src/commands/update.js", () => ({ update: vi.fn() }));

import * as p from "@clack/prompts";
import { fetchTemplates } from "../../src/templates.js";
import { update } from "../../src/commands/update.js";
import { hashContent } from "../../src/manifest.js";
import { init } from "../../src/commands/init.js";

let tmpDir;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "praxis-init-test-"));
  vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });

  p.intro = vi.fn();
  p.outro = vi.fn();
  p.log = {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
  };
  p.spinner = vi.fn(() => ({ start: vi.fn(), stop: vi.fn() }));
  p.cancel = vi.fn();
  p.isCancel = vi.fn().mockReturnValue(false);

  fetchTemplates.mockResolvedValue(
    new Map([
      [".agents/test.md", "# Test"],
      [".agents/sub/nested.md", "# Nested"],
    ])
  );
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("init", () => {
  it("creates files, directories, and manifest on fresh init", async () => {
    await init();

    expect(await readFile(join(tmpDir, ".agents/test.md"), "utf-8")).toBe(
      "# Test"
    );
    expect(
      await readFile(join(tmpDir, ".agents/sub/nested.md"), "utf-8")
    ).toBe("# Nested");

    expect(existsSync(join(tmpDir, ".ai-workflow/ideas"))).toBe(true);
    expect(existsSync(join(tmpDir, ".ai-workflow/plans"))).toBe(true);
    expect(existsSync(join(tmpDir, ".ai-workflow/learnings"))).toBe(true);

    expect(await readFile(join(tmpDir, ".ai-workflow/tags"), "utf-8")).toBe("");

    const manifest = JSON.parse(
      await readFile(join(tmpDir, ".praxis-manifest.json"), "utf-8")
    );
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.installedAt).toBeTruthy();
    expect(manifest.updatedAt).toBe(manifest.installedAt);
    expect(manifest.files[".agents/test.md"].hash).toBe(
      hashContent("# Test")
    );
    expect(manifest.files[".agents/sub/nested.md"].hash).toBe(
      hashContent("# Nested")
    );

    expect(p.outro).toHaveBeenCalledWith(
      expect.stringContaining("2 files installed")
    );
  });

  it("falls back to update when already initialized", async () => {
    await writeFile(
      join(tmpDir, ".praxis-manifest.json"),
      JSON.stringify({ version: "1.0.0", files: {} })
    );

    await init();

    expect(p.log.warn).toHaveBeenCalledWith(
      expect.stringContaining("already initialized")
    );
    expect(update).toHaveBeenCalled();
  });

  it("shows error and exits on fetch failure", async () => {
    fetchTemplates.mockRejectedValue(new Error("Network error"));

    await expect(init()).rejects.toThrow("process.exit(1)");

    expect(p.log.error).toHaveBeenCalledWith("Network error");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("counts existing file with same content as installed", async () => {
    await mkdir(join(tmpDir, ".agents"), { recursive: true });
    await writeFile(join(tmpDir, ".agents/test.md"), "# Test");

    await init();

    expect(await readFile(join(tmpDir, ".agents/test.md"), "utf-8")).toBe(
      "# Test"
    );

    const manifest = JSON.parse(
      await readFile(join(tmpDir, ".praxis-manifest.json"), "utf-8")
    );
    expect(manifest.files[".agents/test.md"]).toBeTruthy();

    expect(p.outro).toHaveBeenCalledWith(
      expect.stringContaining("2 files installed")
    );
  });

  it("overwrites existing file when user chooses overwrite", async () => {
    await mkdir(join(tmpDir, ".agents"), { recursive: true });
    await writeFile(join(tmpDir, ".agents/test.md"), "local content");

    p.select = vi.fn().mockResolvedValue("overwrite");

    await init();

    expect(await readFile(join(tmpDir, ".agents/test.md"), "utf-8")).toBe(
      "# Test"
    );
  });

  it("keeps existing file when user chooses skip", async () => {
    await mkdir(join(tmpDir, ".agents"), { recursive: true });
    await writeFile(join(tmpDir, ".agents/test.md"), "local content");

    p.select = vi.fn().mockResolvedValue("skip");

    await init();

    expect(await readFile(join(tmpDir, ".agents/test.md"), "utf-8")).toBe(
      "local content"
    );

    const manifest = JSON.parse(
      await readFile(join(tmpDir, ".praxis-manifest.json"), "utf-8")
    );
    expect(manifest.files[".agents/test.md"].hash).toBe(
      hashContent("local content")
    );

    expect(p.outro).toHaveBeenCalledWith(expect.stringContaining("skipped"));
  });

  it("shows diff then overwrites when user chooses diff then overwrite", async () => {
    await mkdir(join(tmpDir, ".agents"), { recursive: true });
    await writeFile(join(tmpDir, ".agents/test.md"), "old content");

    p.select = vi
      .fn()
      .mockResolvedValueOnce("diff")
      .mockResolvedValueOnce("overwrite");

    await init();

    expect(p.log.info).toHaveBeenCalledWith(expect.stringContaining("---"));
    expect(await readFile(join(tmpDir, ".agents/test.md"), "utf-8")).toBe(
      "# Test"
    );
  });

  it("shows diff then skips when user chooses diff then skip", async () => {
    await mkdir(join(tmpDir, ".agents"), { recursive: true });
    await writeFile(join(tmpDir, ".agents/test.md"), "old content");

    p.select = vi
      .fn()
      .mockResolvedValueOnce("diff")
      .mockResolvedValueOnce("skip");

    await init();

    expect(await readFile(join(tmpDir, ".agents/test.md"), "utf-8")).toBe(
      "old content"
    );
  });

  it("cancels on first select", async () => {
    await mkdir(join(tmpDir, ".agents"), { recursive: true });
    await writeFile(join(tmpDir, ".agents/test.md"), "local content");

    const cancelSymbol = Symbol("cancel");
    p.select = vi.fn().mockResolvedValue(cancelSymbol);
    p.isCancel = vi.fn((v) => typeof v === "symbol");

    await expect(init()).rejects.toThrow("process.exit(0)");
    expect(p.cancel).toHaveBeenCalled();
  });

  it("cancels on second select after diff", async () => {
    await mkdir(join(tmpDir, ".agents"), { recursive: true });
    await writeFile(join(tmpDir, ".agents/test.md"), "local content");

    const cancelSymbol = Symbol("cancel");
    p.select = vi
      .fn()
      .mockResolvedValueOnce("diff")
      .mockResolvedValueOnce(cancelSymbol);
    p.isCancel = vi.fn((v) => typeof v === "symbol");

    await expect(init()).rejects.toThrow("process.exit(0)");
    expect(p.cancel).toHaveBeenCalled();
  });

  it("blocks path traversal", async () => {
    fetchTemplates.mockResolvedValue(
      new Map([
        ["../../../tmp/praxis-traversal-test", "malicious"],
        [".agents/test.md", "# Test"],
      ])
    );

    await init();

    expect(existsSync(join(tmpDir, "../../../tmp/praxis-traversal-test"))).toBe(
      false
    );

    const manifest = JSON.parse(
      await readFile(join(tmpDir, ".praxis-manifest.json"), "utf-8")
    );
    expect(
      manifest.files["../../../tmp/praxis-traversal-test"]
    ).toBeUndefined();
    expect(manifest.files[".agents/test.md"]).toBeTruthy();
  });

  it("does not overwrite existing tags file", async () => {
    await mkdir(join(tmpDir, ".ai-workflow"), { recursive: true });
    await writeFile(join(tmpDir, ".ai-workflow/tags"), "existing-tag");

    await init();

    expect(await readFile(join(tmpDir, ".ai-workflow/tags"), "utf-8")).toBe(
      "existing-tag"
    );
  });

  it("with --cursor creates .cursor/ mirroring .agents/", async () => {
    await init({ cursor: true });

    expect(await readFile(join(tmpDir, ".cursor/test.md"), "utf-8")).toBe(
      "# Test"
    );
    expect(
      await readFile(join(tmpDir, ".cursor/sub/nested.md"), "utf-8")
    ).toBe("# Nested");

    const manifest = JSON.parse(
      await readFile(join(tmpDir, ".praxis-manifest.json"), "utf-8")
    );
    expect(manifest.tools).toEqual(["cursor"]);
  });

  it("with --claude creates .claude/ mirroring .agents/", async () => {
    await init({ claude: true });

    expect(await readFile(join(tmpDir, ".claude/test.md"), "utf-8")).toBe(
      "# Test"
    );
    const manifest = JSON.parse(
      await readFile(join(tmpDir, ".praxis-manifest.json"), "utf-8")
    );
    expect(manifest.tools).toEqual(["claude"]);
  });

  it("with no tool flags does not create .cursor or .claude", async () => {
    await init();

    expect(existsSync(join(tmpDir, ".cursor"))).toBe(false);
    expect(existsSync(join(tmpDir, ".claude"))).toBe(false);
    const manifest = JSON.parse(
      await readFile(join(tmpDir, ".praxis-manifest.json"), "utf-8")
    );
    expect(manifest.tools).toBeUndefined();
  });

  it("with --opencode exits 1 and writes OpenCode message to stderr", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => {});

    await expect(init({ opencode: true })).rejects.toThrow("process.exit(1)");
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("OpenCode is not yet supported")
    );
  });

  it("passes tool flags and --force to update when already initialized", async () => {
    await init({ cursor: true });
    await init({ cursor: true, force: true });
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: true, force: true })
    );
  });
});
