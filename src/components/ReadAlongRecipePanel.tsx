"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
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
  aiPrompt: "",
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"info" | "error" | "success">("info");

  function notify(text: string, next: "info" | "error" | "success" = "success") {
    setMessage(text);
    setTone(next);
  }

  function fillForm(recipe: Doc<"readAlongRecipes">) {
    setEditId(recipe._id);
    setForm({
      title: recipe.title,
      gradeLevel: recipe.gradeLevel,
      theme: recipe.theme,
      moralLessons: recipe.moralLessons.join("\n"),
      length: recipe.length,
      aiPrompt: recipe.aiPrompt,
      active: recipe.active,
    });
  }

  function resetForm() {
    setEditId(null);
    setForm(emptyForm);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const moralLessons = form.moralLessons
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (editId) {
        await updateRecipe({
          recipeId: editId,
          title: form.title,
          gradeLevel: form.gradeLevel,
          theme: form.theme,
          moralLessons,
          length: form.length,
          aiPrompt: form.aiPrompt,
          active: form.active,
        });
        notify("Recipe updated.");
      } else {
        await createRecipe({
          familyId,
          title: form.title,
          gradeLevel: form.gradeLevel,
          theme: form.theme,
          moralLessons,
          length: form.length,
          aiPrompt: form.aiPrompt,
          active: form.active,
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
        description="This form is the blueprint for generated stories: grade, theme, moral lessons, length, and the AI prompt."
      >
        <form onSubmit={(e) => void onSave(e)} className="space-y-4 max-w-2xl">
          <Input
            label="Recipe title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Kindness at home"
            required
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
          <Textarea
            label="AI prompt (required — sent to the generator)"
            rows={6}
            value={form.aiPrompt}
            onChange={(e) =>
              setForm((f) => ({ ...f, aiPrompt: e.target.value }))
            }
            placeholder="Write a gentle read-aloud about…"
            required
          />
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
