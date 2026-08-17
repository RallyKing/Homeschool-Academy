"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import {
  buildReadAlongRecipePrompt,
  parseMoralLessons,
  recipeTitleFromFields,
} from "../../convex/lib/readAlongPrompt";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Message,
  Section,
  Select,
  Textarea,
} from "@/components/ui";
import {
  GRADE_LEVEL_OPTIONS,
  LENGTH_OPTIONS,
} from "@/lib/readAlongRecipeOptions";

const emptyForm = {
  title: "",
  gradeLevel: "3-5",
  theme: "",
  moralLessons: "",
  length: "medium" as "short" | "medium" | "long",
  customPrompt: "",
  active: true,
};

export function ReadAlongRecipePanel({
  familyId,
}: {
  familyId: Id<"families">;
}) {
  const recipes = useQuery(api.readAlongRecipes.listForFamily, { familyId });
  const createRecipe = useMutation(api.readAlongRecipes.create);
  const updateRecipe = useMutation(api.readAlongRecipes.update);
  const removeRecipe = useMutation(api.readAlongRecipes.remove);
  const ensureDefaults = useMutation(api.readAlongRecipes.ensureDefaults);

  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<Id<"readAlongRecipes"> | null>(null);
  const [customize, setCustomize] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"info" | "error" | "success">("info");

  const moralLessons = useMemo(
    () => parseMoralLessons(form.moralLessons),
    [form.moralLessons],
  );
  const generatedPrompt = useMemo(
    () =>
      buildReadAlongRecipePrompt({
        title: recipeTitleFromFields(form.title, form.theme),
        gradeLevel: form.gradeLevel,
        theme: form.theme,
        moralLessons,
        length: form.length,
      }),
    [form.title, form.gradeLevel, form.theme, form.length, moralLessons],
  );

  function notify(text: string, next: "info" | "error" | "success" = "success") {
    setMessage(text);
    setTone(next);
  }

  function fillForm(recipe: Doc<"readAlongRecipes">) {
    const autoPrompt = buildReadAlongRecipePrompt({
      title: recipe.title,
      gradeLevel: recipe.gradeLevel,
      theme: recipe.theme,
      moralLessons: recipe.moralLessons,
      length: recipe.length,
    });
    const isCustom = recipe.aiPrompt.trim() !== autoPrompt.trim();
    setEditId(recipe._id);
    setCustomize(isCustom);
    setForm({
      title: recipe.title,
      gradeLevel: recipe.gradeLevel,
      theme: recipe.theme,
      moralLessons: recipe.moralLessons.join("\n"),
      length: recipe.length,
      customPrompt: isCustom ? recipe.aiPrompt : "",
      active: recipe.active,
    });
  }

  function resetForm() {
    setEditId(null);
    setCustomize(false);
    setForm(emptyForm);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const lessons = parseMoralLessons(form.moralLessons);
      const customPrompt = customize ? form.customPrompt.trim() : "";
      const payload = {
        title: form.title,
        gradeLevel: form.gradeLevel,
        theme: form.theme,
        moralLessons: lessons,
        length: form.length,
        active: form.active,
        ...(customPrompt ? { aiPrompt: customPrompt } : { aiPrompt: "" }),
      };
      if (editId) {
        await updateRecipe({
          recipeId: editId,
          ...payload,
        });
        notify("Recipe updated.");
      } else {
        await createRecipe({
          familyId,
          ...payload,
        });
        notify("Recipe saved — students can generate stories from it.");
      }
      resetForm();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Message tone={tone}>{message}</Message>

      <Section
        title={editId ? "Edit story recipe" : "New story recipe"}
        description="Fill grade, theme, moral lessons, and length. The AI prompt is generated from those fields."
      >
        <form onSubmit={(e) => void onSave(e)} className="space-y-4 max-w-2xl">
          <Input
            label="Recipe title"
            hint="Optional — leave blank to use the theme."
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Kindness at home"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Grade level"
              value={form.gradeLevel}
              onChange={(e) =>
                setForm((f) => ({ ...f, gradeLevel: e.target.value }))
              }
            >
              {GRADE_LEVEL_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
            <Select
              label="Length"
              value={form.length}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  length: e.target.value as "short" | "medium" | "long",
                }))
              }
            >
              {LENGTH_OPTIONS.map((row) => (
                <option key={row.value} value={row.value}>
                  {row.label}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="Theme"
            value={form.theme}
            onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value }))}
            placeholder="Friendship, weather, backyard science…"
            required
          />
          <Textarea
            label="Moral lessons (one per line)"
            rows={3}
            value={form.moralLessons}
            onChange={(e) =>
              setForm((f) => ({ ...f, moralLessons: e.target.value }))
            }
            placeholder={"Notice who needs help\nChoose a kind action"}
            required
          />
          <div>
            <p className="text-sm font-medium text-[var(--muted)]">
              Generated AI prompt
            </p>
            <p className="mt-1.5 whitespace-pre-wrap rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--foreground)]">
              {form.theme.trim() && moralLessons.length > 0
                ? generatedPrompt
                : "Add a theme and at least one moral lesson to preview the prompt."}
            </p>
            {customize ? (
              <p className="mt-1 text-xs text-[var(--muted-fg)]">
                Custom prompt will be sent instead.{" "}
                <button
                  type="button"
                  className="font-medium text-[var(--accent)] hover:underline"
                  onClick={() => {
                    setCustomize(false);
                    setForm((f) => ({ ...f, customPrompt: "" }));
                  }}
                >
                  Use generated prompt
                </button>
              </p>
            ) : (
              <p className="mt-1 text-xs text-[var(--muted-fg)]">
                Updates as you type. Saved with the recipe for the story
                generator.
              </p>
            )}
          </div>
          <details
            className="text-sm"
            open={customize}
            onToggle={(e) => {
              const open = e.currentTarget.open;
              setCustomize(open);
              if (!open) {
                setForm((f) => ({ ...f, customPrompt: "" }));
              }
            }}
          >
            <summary className="hover-fade cursor-pointer font-medium text-[var(--muted)]">
              Customize prompt (advanced)
            </summary>
            <div className="mt-2 space-y-2">
              <Textarea
                label="Custom AI prompt"
                rows={6}
                value={form.customPrompt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, customPrompt: e.target.value }))
                }
                placeholder={generatedPrompt}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setForm((f) => ({ ...f, customPrompt: generatedPrompt }))
                }
              >
                Regenerate from fields
              </Button>
            </div>
          </details>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) =>
                setForm((f) => ({ ...f, active: e.target.checked }))
              }
            />
            Active (students can generate from this recipe)
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : editId ? "Save recipe" : "Create recipe"}
            </Button>
            {editId ? (
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancel edit
              </Button>
            ) : null}
            {recipes && recipes.length === 0 ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void ensureDefaults({ familyId })
                    .then(() => notify("Added two starter recipes."))
                    .catch((err) =>
                      notify(
                        err instanceof Error ? err.message : "Failed",
                        "error",
                      ),
                    )
                }
              >
                Add starter recipes
              </Button>
            ) : null}
          </div>
        </form>
      </Section>

      <Section title="Saved recipes">
        {!recipes ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : recipes.length === 0 ? (
          <EmptyState>
            No recipes yet. Fill the form above or add starter recipes.
          </EmptyState>
        ) : (
          <div className="space-y-1.5">
            {recipes.map((recipe) => (
              <div key={recipe._id} className="list-row">
                <div className="min-w-0">
                  <p className="font-medium">{recipe.title}</p>
                  <p className="text-xs text-[var(--muted)]">
                    Grade {recipe.gradeLevel} · {recipe.theme} · {recipe.length}{" "}
                    · {recipe.moralLessons.join(", ")}
                  </p>
                </div>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={recipe.active ? "success" : "neutral"}>
                    {recipe.active ? "active" : "off"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => fillForm(recipe)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (!window.confirm("Delete this story recipe?")) return;
                      void removeRecipe({ recipeId: recipe._id })
                        .then(() => {
                          if (editId === recipe._id) resetForm();
                          notify("Recipe deleted.");
                        })
                        .catch((err) =>
                          notify(
                            err instanceof Error ? err.message : "Failed",
                            "error",
                          ),
                        );
                    }}
                  >
                    Delete
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
