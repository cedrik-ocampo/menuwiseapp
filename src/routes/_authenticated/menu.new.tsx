import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, CircleHelp, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDB, put, type DBView } from "@/lib/store";
import { costPerUnit, foodCostPct, margin, recipeCost } from "@/lib/calc";
import { ITEM_TYPES, type MenuItem, type RecipeLine } from "@/lib/types";
import { compatibleRecipeUnits, ingredientAmountCost, ITEM_TYPE_LABELS, itemTypeFromLabel } from "@/lib/menu-costing";
import { formatPeso, uid } from "@/lib/format";
import { fileToDataUrl } from "@/lib/image";
import { Field, Panel, Segmented, btnPrimary, btnSecondary, inputCls } from "@/components/mw/ui";
import { IngredientForm } from "@/components/mw/IngredientForm";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProductionTabs } from "@/components/mw/ProductionTabs";
import { MenuImport } from "@/components/mw/MenuImport";
import { parseMenuRows } from "@/lib/import-parsers";
import { compatibleRecipeUnits as importUnits } from "@/lib/menu-costing";

const MENU_COLS = "Menu_Item_Name, category, type, Selling_Price, Shelf_Life_Days, Expires_When";
const MENU_TEMPLATE_COLS = ["Menu_Item_Name", "category", "subcategory", "type", "Selling_Price", "Batch_Yield", "Batch_Purchase_Price", "Pieces_Per_Batch", "Ingredient_Name", "Amount", "Unit", "Shelf_Life_Days", "Expires_When", "Description", "Tags", "Supplier", "Available"];
const EXPIRY_OPTIONS = ["After the shelf life", "At the end of the same day", "Made to order — no expiry tracking"];
const TYPE_OPTIONS = ITEM_TYPES.map((type) => ITEM_TYPE_LABELS[type]);

export const CATS: Record<string, string[]> = {
  Pastry: ["Croissants & Danishes", "Bread", "Tart", "Cake", "Cookie"],
  Drinks: ["Espresso", "Non-coffee", "Tea", "Cold drinks"],
};

function internalId(index: number) {
  return `MI-${String(index + 1).padStart(3, "0")}-${uid().slice(-4)}`;
}


export const Route = createFileRoute("/_authenticated/menu/new")({
  head: () => ({
    meta: [
      { title: "Add New Menu Item — MenuWise" },
      { name: "description", content: "Create a menu item and calculate its cost from its recipe or purchase batch." },
      { property: "og:title", content: "Add New Menu Item — MenuWise" },
      { property: "og:description", content: "Create a menu item and calculate its cost from its recipe or purchase batch." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AddMenuItem,
});

type RecipeDraft = RecipeLine & { key: number; ingredientSearch: string };
type Draft = Omit<MenuItem, "recipe"> & { recipe: RecipeDraft[]; tagsText: string; outsourcedBatchPrice: number; outsourcedPieces: number };

function blank(nextId: string): Draft {
  return {
    id: nextId, name: "", category: "Pastry", subcategory: "", description: "", available: true, tags: [], tagsText: "",
    type: "In-house", batchCost: 0, yield: 1, purchaseCost: 0, outsourcedBatchPrice: 0, outsourcedPieces: 1, unit: "piece", retailPrice: 0,
    supplier: "", shelfLifeDays: 2, expiryRule: EXPIRY_OPTIONS[0], defaultBatchSize: 1, batchUnit: "pieces", defaultExpiryDays: 2,
    defaultWasteStage: "Finished Product", defaultWasteType: "Unsold", allowQuickAdd: true, recipe: [],
  };
}

function AddMenuItem() {
  const db = useDB();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => blank(internalId(db.menuItems.length)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [drawerRow, setDrawerRow] = useState<number | null>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const outsourced = draft.type === "Outsourced";
  const individual = draft.type === "Made-to-order";
  const recipeTotal = recipeCost(db, draft);
  const effective = useMemo(() => ({
    ...draft,
    batchCost: outsourced ? 0 : recipeTotal,
    yield: individual ? 1 : draft.yield,
    purchaseCost: outsourced && draft.outsourcedPieces > 0 ? draft.outsourcedBatchPrice / draft.outsourcedPieces : 0,
  }), [draft, individual, outsourced, recipeTotal]);
  const itemCost = costPerUnit(effective);

  function updateRecipe(index: number, change: Partial<RecipeDraft>) {
    set("recipe", draft.recipe.map((line, lineIndex) => lineIndex === index ? { ...line, ...change } : line));
  }

  function selectIngredient(index: number, name: string) {
    const ingredient = db.ingredients.find((item) => item.name.toLowerCase() === name.trim().toLowerCase());
    updateRecipe(index, ingredient
      ? { ingredientSearch: ingredient.name, ingredientId: ingredient.id, unit: ingredient.unit }
      : { ingredientSearch: name, ingredientId: "" });
  }

  function validate(targetStep: number) {
    const nextErrors: Record<string, string> = {};
    if (targetStep >= 0) {
      if (!draft.name.trim()) nextErrors.name = "Menu item name is required";
      else if (db.menuItems.some((item) => item.name.toLowerCase() === draft.name.trim().toLowerCase())) nextErrors.name = "A menu item with this name already exists";
      if (!draft.category) nextErrors.category = "Choose a category";
      if (!(draft.retailPrice > 0)) nextErrors.retailPrice = "Selling price must be more than 0";
    }
    if (targetStep >= 1) {
      if (!(draft.shelfLifeDays >= 0)) nextErrors.shelfLifeDays = "Shelf life must be 0 or more";
      if (outsourced) {
        if (!(draft.outsourcedBatchPrice > 0)) nextErrors.outsourcedBatchPrice = "Batch purchase price must be more than 0";
        if (!(draft.outsourcedPieces > 0)) nextErrors.outsourcedPieces = "Pieces per batch must be more than 0";
      } else {
        if (!individual && !(draft.yield > 0)) nextErrors.yield = "Batch yield must be more than 0";
        if (!draft.recipe.length) nextErrors.recipe = "Add at least one ingredient to the recipe";
        draft.recipe.forEach((line, index) => {
          const ingredient = db.ingredients.find((item) => item.id === line.ingredientId);
          if (!ingredient) nextErrors[`recipe-${index}`] = "Choose an ingredient from the list";
          else if (!(line.quantity > 0)) nextErrors[`recipe-${index}`] = "Amount must be more than 0";
          else if (!Number.isFinite(ingredientAmountCost(ingredient, line.quantity, line.unit))) nextErrors[`recipe-${index}`] = `${line.unit} cannot be converted to ${ingredient.unit}`;
        });
      }
    }
    setErrors(nextErrors);
    return nextErrors;
  }

  function next() {
    if (Object.keys(validate(step)).length) return;
    setStep((current) => Math.min(2, current + 1));
  }

  function save(addAnother: boolean) {
    const nextErrors = validate(1);
    if (Object.keys(nextErrors).length) {
      setStep(nextErrors.name || nextErrors.category || nextErrors.retailPrice ? 0 : 1);
      return;
    }
    const { tagsText, recipe, outsourcedBatchPrice: _batchPrice, outsourcedPieces: _pieces, ...rest } = effective;
    const item: MenuItem = {
      ...rest,
      name: draft.name.trim(),
      tags: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
      recipe: outsourced ? [] : recipe.map(({ key: _key, ingredientSearch: _search, ...line }) => line),
      batchCost: outsourced ? 0 : recipeTotal,
      defaultBatchSize: individual || outsourced ? 1 : draft.yield,
      defaultExpiryDays: draft.expiryRule === EXPIRY_OPTIONS[1] ? 0 : draft.shelfLifeDays,
    };
    put("menuItems", item);
    toast.success(`${item.name} saved`);
    if (addAnother) {
      setDraft(blank(internalId(db.menuItems.length + 1)));
      setStep(0);
    } else navigate({ to: "/menu/$id", params: { id: item.id } });
  }

  const numberValue = (value: string) => value === "" ? 0 : parseFloat(value);
  const costingTitle = draft.name.trim() ? `${draft.name.trim()} Costing` : "Menu Item Costing";

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-accent">
        <Link to="/menu-items" search={{ item: undefined }} className="font-medium hover:underline">Menu Items</Link> <span className="text-muted-foreground">&gt;</span> <span className="text-muted-foreground">Add New Menu Item</span>
      </nav>
      <ProductionTabs active="add" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-bold text-primary md:text-3xl">Add New Menu Item</h2>
        <MenuImport />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">For recipes, use one row per ingredient and repeat the same menu item name.</p>

      <ol className="my-5 grid max-w-2xl grid-cols-3 gap-2">
        {["Basic Info", "Costing & Recipe", "Review"].map((label, index) => (
          <li key={label}>
            <button type="button" disabled={index > step} onClick={() => setStep(index)} className={`h-full w-full rounded-lg px-3 py-2 text-xs font-semibold ${index === step ? "bg-primary text-primary-foreground" : index < step ? "bg-secondary text-primary" : "bg-muted text-muted-foreground"}`}>
              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="mx-auto max-w-4xl space-y-4">
        {step === 0 && (
          <Panel className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field required label="Menu Item Name" error={errors.name}><input className={inputCls} value={draft.name} onChange={(event) => set("name", event.target.value)} placeholder="Chocolate Croissant" /></Field></div>
            <Field required label="Category" error={errors.category}>
              <select className={inputCls} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value, subcategory: "" })}>{Object.keys(CATS).map((category) => <option key={category}>{category}</option>)}</select>
            </Field>
            <Field label="Subcategory"><select className={inputCls} value={draft.subcategory} onChange={(event) => set("subcategory", event.target.value)}><option value="">Unselected</option>{(CATS[draft.category] ?? []).map((subcategory) => <option key={subcategory}>{subcategory}</option>)}</select></Field>
            <Field required label="Selling Price (per piece)" error={errors.retailPrice}><input inputMode="decimal" className={inputCls} value={draft.retailPrice || ""} onChange={(event) => set("retailPrice", numberValue(event.target.value))} placeholder="₱0.00" /></Field>
            <Field label="Tags · optional" hint="Separate with commas"><input className={inputCls} value={draft.tagsText} onChange={(event) => set("tagsText", event.target.value)} placeholder="bestseller, breakfast" /></Field>
            <div className="sm:col-span-2"><Field label="Description · optional"><textarea className={`${inputCls} h-20 py-2`} maxLength={300} value={draft.description} onChange={(event) => set("description", event.target.value)} /></Field></div>
            <Field label="Image · optional" hint="Shown in Menu Catalog">
              <div className="flex items-center gap-3">
                {draft.image && <img src={draft.image} alt="" className="h-12 w-12 rounded-lg border border-border object-cover" />}
                <input type="file" accept="image/*" className={`${inputCls} py-2`} onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try { set("image", await fileToDataUrl(file)); } catch { toast.error("Couldn't read that image"); }
                }} />
              </div>
            </Field>
            <label className="flex items-center gap-3 self-end pb-3 text-sm font-semibold text-primary"><Switch checked={draft.available} onCheckedChange={(value) => set("available", value)} /> Available for sale</label>
          </Panel>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-bold text-primary">{costingTitle}</h3>
              <p className="text-sm text-muted-foreground">Choose how this item is prepared, then enter only the details needed to calculate its cost.</p>
            </div>
            <Panel className="space-y-5">
              <Segmented value={ITEM_TYPE_LABELS[draft.type]} options={TYPE_OPTIONS} onChange={(label) => {
                const type = itemTypeFromLabel(label);
                if (type) set("type", type);
              }} />

              {outsourced ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field required label="Batch Purchase Price" hint="What you pay for the full purchased batch." error={errors.outsourcedBatchPrice}><input inputMode="decimal" className={inputCls} value={draft.outsourcedBatchPrice || ""} onChange={(event) => set("outsourcedBatchPrice", numberValue(event.target.value))} /></Field>
                  <Field required label="Pieces in the Batch" error={errors.outsourcedPieces}><input inputMode="numeric" className={inputCls} value={draft.outsourcedPieces || ""} onChange={(event) => set("outsourcedPieces", numberValue(event.target.value))} /></Field>
                  <div className="rounded-lg bg-info-soft p-4 sm:col-span-2"><p className="text-xs text-muted-foreground">Cost per piece · calculated</p><p className="text-2xl font-bold text-primary">{formatPeso(itemCost)}</p></div>
                </div>
              ) : (
                <>
                  {!individual && <Field required label="Pieces Made per Batch" hint="The number of saleable pieces this recipe produces." error={errors.yield}><input inputMode="numeric" className={inputCls} value={draft.yield || ""} onChange={(event) => set("yield", numberValue(event.target.value))} /></Field>}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3"><h4 className="font-bold text-primary">Recipe Ingredients</h4><span className="text-xs text-muted-foreground">Costs come from Ingredient Inventory</span></div>
                    <datalist id="ingredient-names">{db.ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.name} />)}</datalist>
                    {draft.recipe.map((line, index) => {
                      const ingredient = db.ingredients.find((item) => item.id === line.ingredientId);
                      const lineCost = ingredientAmountCost(ingredient, line.quantity, line.unit);
                      const units = compatibleRecipeUnits(ingredient?.unit);
                      return (
                        <div key={line.key} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1.8fr)_minmax(90px,.7fr)_minmax(90px,.7fr)_minmax(110px,.8fr)_40px] sm:items-end">
                          <Field label="Ingredient Name"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input list="ingredient-names" className={`${inputCls} pl-9`} value={line.ingredientSearch} onChange={(event) => selectIngredient(index, event.target.value)} placeholder="Search by name" /></div></Field>
                          <Field label="Amount"><input inputMode="decimal" className={inputCls} value={line.quantity || ""} onChange={(event) => updateRecipe(index, { quantity: numberValue(event.target.value) })} /></Field>
                          <Field label="Unit"><select className={inputCls} value={line.unit} onChange={(event) => updateRecipe(index, { unit: event.target.value })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></Field>
                          <Field label={<span className="inline-flex items-center gap-1">Ingredient Cost <Popover><PopoverTrigger asChild><button type="button" aria-label="What is ingredient cost?" className="text-accent"><CircleHelp className="h-4 w-4" /></button></PopoverTrigger><PopoverContent className="w-64 text-sm">The cost of the amount used in this recipe, based on the ingredient’s saved unit cost.</PopoverContent></Popover></span>}><input className={inputCls} disabled value={Number.isFinite(lineCost) ? formatPeso(lineCost) : "Incompatible unit"} /></Field>
                          <button type="button" aria-label="Remove ingredient" className="flex h-11 items-center justify-center text-destructive" onClick={() => set("recipe", draft.recipe.filter((_, lineIndex) => lineIndex !== index))}><Trash2 className="h-4 w-4" /></button>
                          {errors[`recipe-${index}`] && <p className="text-xs text-destructive sm:col-span-5">{errors[`recipe-${index}`]}</p>}
                        </div>
                      );
                    })}
                    {errors.recipe && <p className="text-sm text-destructive">{errors.recipe}</p>}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={btnSecondary} onClick={() => set("recipe", [...draft.recipe, { key: Date.now(), ingredientSearch: "", ingredientId: "", quantity: 0, unit: "g", allocation: "Recipe-based" }])}><Plus className="h-4 w-4" /> Add Ingredient</button>
                      <button type="button" className={btnSecondary} onClick={() => { set("recipe", [...draft.recipe, { key: Date.now(), ingredientSearch: "", ingredientId: "", quantity: 0, unit: "g", allocation: "Recipe-based" }]); setDrawerRow(draft.recipe.length); }}><Plus className="h-4 w-4" /> Create New Ingredient</button>
                    </div>
                  </div>
                  <div className="grid gap-3 rounded-lg bg-info-soft p-4 sm:grid-cols-3">
                    <p><span className="block text-xs text-muted-foreground">{individual ? "Total Ingredient Cost" : "Total Batch Ingredient Cost"}</span><b className="text-xl text-primary">{formatPeso(recipeTotal)}</b></p>
                    {!individual && <p><span className="block text-xs text-muted-foreground">Pieces per Batch</span><b className="text-xl text-primary">{draft.yield || 0}</b></p>}
                    <p><span className="block text-xs text-muted-foreground">Cost per Piece</span><b className="text-xl text-primary">{formatPeso(itemCost)}</b></p>
                  </div>
                </>
              )}

              <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                <Field required label="Shelf Life (days)" error={errors.shelfLifeDays}><input inputMode="numeric" className={inputCls} value={draft.shelfLifeDays} onChange={(event) => set("shelfLifeDays", numberValue(event.target.value))} /></Field>
                <Field label="Expires When"><select className={inputCls} value={draft.expiryRule} onChange={(event) => set("expiryRule", event.target.value)}>{EXPIRY_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></Field>
              </div>
            </Panel>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Check the item before saving. Costs update automatically from the recipe and Ingredient Inventory.</p>
            <Panel className="space-y-3 text-sm">
              <h3 className="text-xl font-bold text-primary">{draft.name || "Menu Item"}</h3>
              {[
                ["Category", `${draft.category}${draft.subcategory ? ` · ${draft.subcategory}` : ""}`],
                ["Item Type", ITEM_TYPE_LABELS[draft.type]],
                ["Selling Price per Piece", formatPeso(draft.retailPrice)],
                ["Cost per Piece", formatPeso(itemCost)],
                ["Margin per Piece", formatPeso(margin(effective))],
                ["Food Cost", `${foodCostPct(effective).toFixed(1)}%`],
                ["Recipe Ingredients", outsourced ? "Not required" : String(draft.recipe.length)],
                ["Expires When", `${draft.expiryRule}${draft.expiryRule === EXPIRY_OPTIONS[0] ? ` · ${draft.shelfLifeDays} day${draft.shelfLifeDays === 1 ? "" : "s"}` : ""}`],
              ].map(([label, value]) => <p key={label} className="flex justify-between gap-4 border-b border-border pb-2"><span className="text-muted-foreground">{label}</span><b className="text-right text-primary">{value}</b></p>)}
            </Panel>
          </div>
        )}

        <div className="sticky bottom-20 z-30 flex flex-wrap gap-2 rounded-lg border border-border bg-card p-3 shadow-lg md:bottom-4">
          <button type="button" className={btnSecondary} onClick={() => navigate({ to: "/menu-items", search: { item: undefined } })}>Cancel</button>
          <button type="button" className={btnSecondary} disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>Back</button>
          {step < 2 ? <button type="button" className={`${btnPrimary} ml-auto`} onClick={next}>Next</button> : <>
            <button type="button" className={`${btnSecondary} ml-auto`} onClick={() => save(true)}>Save & Add Another</button>
            <button type="button" className={btnPrimary} onClick={() => save(false)}><Check className="h-4 w-4" /> Save Menu Item</button>
          </>}
        </div>
      </div>

      <Sheet open={drawerRow !== null} onOpenChange={(open) => !open && setDrawerRow(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader><SheetTitle>Add Ingredient</SheetTitle></SheetHeader>
          <div className="mt-4"><IngredientForm compact onCancel={() => setDrawerRow(null)} onSaved={(ingredient) => {
            if (drawerRow !== null) updateRecipe(drawerRow, { ingredientId: ingredient.id, ingredientSearch: ingredient.name, unit: ingredient.unit });
            setDrawerRow(null);
          }} /></div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
