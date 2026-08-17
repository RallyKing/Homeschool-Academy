/** Keep the student's recipe pick across async reloads. Never default to the first item. */
export function retainRecipeSelection(
  selectedId: string,
  recipes: ReadonlyArray<{ _id: string }> | undefined,
): string {
  if (!selectedId) return "";
  if (!recipes) return selectedId;
  if (recipes.some((recipe) => recipe._id === selectedId)) return selectedId;
  return selectedId;
}
