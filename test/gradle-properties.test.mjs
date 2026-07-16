import { strict as assert } from "node:assert";
import test from "node:test";
import { getGradleProperty } from "../dist/gradle-properties.js";

const PROPERTIES = `
# a comment line without an equals sign
appName = com.example.myapp
version=1.2.3
repoUrl=https://example.com/repo?ref=main
`;

test("reads and trims a property value", () => {
  assert.equal(getGradleProperty("appName", PROPERTIES), "com.example.myapp");
  assert.equal(getGradleProperty("version", PROPERTIES), "1.2.3");
});

test("keeps `=` characters inside the value", () => {
  assert.equal(getGradleProperty("repoUrl", PROPERTIES), "https://example.com/repo?ref=main");
});

test("returns undefined for a missing key", () => {
  assert.equal(getGradleProperty("does.not.exist", PROPERTIES), undefined);
});

test("returns undefined for empty input", () => {
  assert.equal(getGradleProperty("appName", ""), undefined);
});
