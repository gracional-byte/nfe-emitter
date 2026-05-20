import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Private Key Validation", () => {
  it("should have local file or valid env var", () => {
    const localKeyPath = path.join(process.cwd(), 'private-key.pem');
    const hasLocalFile = fs.existsSync(localKeyPath);
    
    // Local file should exist (primary method)
    expect(hasLocalFile).toBeTruthy();
  });

  it("should have valid PEM format in local file", () => {
    const localKeyPath = path.join(process.cwd(), 'private-key.pem');
    if (fs.existsSync(localKeyPath)) {
      const privateKey = fs.readFileSync(localKeyPath, 'utf-8');
      expect(privateKey).toContain("-----BEGIN");
      expect(privateKey).toContain("-----END");
      expect(privateKey.length).toBeGreaterThan(500);
    }
  });
});
