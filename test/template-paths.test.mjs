import { strict as assert } from "node:assert";
import test from "node:test";
import { getDependencyFilePaths } from "../dist/plugins/template-paths.js";
import { FREEMARKER_IMPORT, THYMELEAF_REPLACE } from "../dist/plugins/xp-templates.js";

test("freemarker: square- and angle-bracket import/include", () => {
  const source = `
    [#import "../../views/partials/header/header.ftl" as h]
    [#import "../../views/partials/footer/footer.ftl" as f]
    [#include "../../views/partials/body/body.ftlh"]
    <#import "../../views/partials/nav/nav.ftl" as n>
    <#include "../../views/partials/aside/aside.ftlh">
  `;

  const filePaths = getDependencyFilePaths(source, "", FREEMARKER_IMPORT);

  assert.deepStrictEqual(filePaths, [
    "../../views/partials/header/header.ftl",
    "../../views/partials/footer/footer.ftl",
    "../../views/partials/body/body.ftlh",
    "../../views/partials/nav/nav.ftl",
    "../../views/partials/aside/aside.ftlh",
  ]);
});

test("freemarker: root-relative path anchors at src/main/resources", () => {
  const resourcePath = "/home/me/project/src/main/resources/site/pages/page.ftl";
  const source = `[#include "/site/views/header.ftl"]`;

  const filePaths = getDependencyFilePaths(source, resourcePath, FREEMARKER_IMPORT);

  assert.deepStrictEqual(filePaths, ["/home/me/project/src/main/resources/site/views/header.ftl"]);
});

test("thymeleaf: bare path and fragment selector, `.html` appended", () => {
  const source = `
    <nav data-th-replace="../../views/fragments/language-picker/language-picker"></nav>
    <div
      data-th-replace="/site/views/fragments/enonic-lib-menu/breadcrumb :: breadcrumb(\${breadcrumbs})">
      Home
    </div>
    <div data-th-insert="../views/parts/promo"></div>
  `;
  const resourcePath = "/home/me/project/src/main/resources/site/pages/page.html";

  const filePaths = getDependencyFilePaths(source, resourcePath, THYMELEAF_REPLACE, ".html");

  assert.deepStrictEqual(filePaths, [
    "../../views/fragments/language-picker/language-picker.html",
    "/home/me/project/src/main/resources/site/views/fragments/enonic-lib-menu/breadcrumb.html",
    "../views/parts/promo.html",
  ]);
});

test("thymeleaf: `~{ }` fragment-expression wrapper", () => {
  const source = `
    <nav data-th-replace="~{../../views/fragments/language-picker/language-picker}"></nav>
    <div data-th-replace="~{/site/views/fragments/enonic-lib-menu/breadcrumb :: breadcrumb(\${breadcrumbs})}"></div>
  `;
  const resourcePath = "/home/me/project/src/main/resources/site/pages/page.html";

  const filePaths = getDependencyFilePaths(source, resourcePath, THYMELEAF_REPLACE, ".html");

  assert.deepStrictEqual(filePaths, [
    "../../views/fragments/language-picker/language-picker.html",
    "/home/me/project/src/main/resources/site/views/fragments/enonic-lib-menu/breadcrumb.html",
  ]);
});
