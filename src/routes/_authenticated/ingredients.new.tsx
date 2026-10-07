import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageTitle } from "@/components/mw/AppShell";
import { IngredientForm } from "@/components/mw/IngredientForm";

export const Route = createFileRoute("/_authenticated/ingredients/new")({
  head: () => ({
    meta: [
      { title: "Add Ingredient — MenuWise" },
      { name: "description", content: "Manually add an ingredient purchase to your inventory." },
      { property: "og:title", content: "Add Ingredient — MenuWise" },
      { property: "og:description", content: "Manually add an ingredient purchase to your inventory." },
    ],
  }),
  component: NewIngredient,
});

function NewIngredient() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle back={{ to: "/ingredients", label: "Ingredient Inventory > Manual Input" }} title="Manually Add Ingredient" subtitle="Enter the purchase details. Stock value is calculated for you." />
      <IngredientForm onSaved={(i) => navigate({ to: "/ingredients/$id", params: { id: i.id } })} onCancel={() => navigate({ to: "/ingredients" })} />
    </div>
  );
}
