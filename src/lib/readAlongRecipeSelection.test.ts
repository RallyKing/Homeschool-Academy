import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { retainRecipeSelection } from "./readAlongRecipeSelection.ts";

describe("retainRecipeSelection", () => {
  const garden = { _id: "recipe_garden" };
  const sister = { _id: "recipe_sister" };

  it("keeps a user pick when the recipe list reloads", () => {
    assert.equal(
      retainRecipeSelection("recipe_sister", [garden, sister]),
      "recipe_sister",
    );
  });

  it("does not snap to the first recipe when nothing is selected yet", () => {
    assert.equal(retainRecipeSelection("", [garden, sister]), "");
  });

  it("does not overwrite a pick while recipes are still loading", () => {
    assert.equal(retainRecipeSelection("recipe_sister", undefined), "recipe_sister");
  });
});
