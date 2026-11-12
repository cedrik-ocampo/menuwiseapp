import { keyOf, type Row } from "./import";

/** Common header names used by POS exports and hand-made sheets, keyed by MenuWise field key. */
export const SYNONYMS: Record<string, string[]> = {
  ingredientid: ["id", "sku", "code", "itemcode", "productcode", "barcode"],
  ingredientname: ["name", "item", "itemname", "product", "productname", "description", "particulars", "ingredient", "material"],
  menuitemname: ["name", "item", "itemname", "product", "productname", "menuitem"],
  menuitemid: ["item", "itemname", "product", "productname", "menuitem", "menuitemname", "name"],
  category: ["type", "group", "class", "categoryname", "department"],
  storage: ["location", "storagelocation", "storedin"],
  unit: ["uom", "unitofmeasure", "measure", "units"],
  supplier: ["vendor", "source", "suppliername", "seller"],
  purchasedate: ["date", "datepurchased", "received", "datereceived", "deliverydate", "orderdate"],
  expirydate: ["expiry", "expiration", "expirationdate", "bestbefore", "useby", "exp", "expdate"],
  quantity: ["qty", "count", "stock", "onhand", "instock", "pieces", "pcs", "sold", "qtysold", "amount"],
  unitcost: ["cost", "price", "costperunit", "unitprice", "purchaseprice", "cost/unit"],
  sellingprice: ["price", "srp", "retailprice", "sellingprice", "unitprice"],
  unitprice: ["price", "srp", "unitprice", "sellingprice"],
  saledate: ["date", "transactiondate", "timestamp", "day"],
  notes: ["remarks", "comment", "comments", "note"],
};

export type Mapping = Record<string, { column?: string; fixed?: string }>;

/** Guess which file column fills each MenuWise field: exact match first, then known synonyms. */
export function guessMapping(fields: string[], columns: string[]): Mapping {
  const used = new Set<string>();
  const out: Mapping = {};
  const byKey = new Map(columns.map((c) => [keyOf(c), c]));
  for (const f of fields) { const c = byKey.get(f); if (c) { out[f] = { column: c }; used.add(c); } }
  for (const f of fields) {
    if (out[f]) continue;
    const c = (SYNONYMS[f] ?? []).map((s) => byKey.get(keyOf(s))).find((c) => c && !used.has(c));
    if (c) { out[f] = { column: c }; used.add(c); } else out[f] = {};
  }
  return out;
}

/** True when the file already uses every template column. */
export function matchesTemplate(fields: string[], columns: string[]) {
  const keys = new Set(columns.map(keyOf));
  return fields.every((f) => keys.has(f));
}

/** Clean "₱1,250.00" → "1250.00" for numeric fields. */
export function cleanNumber(v: string) { const s = v.replace(/[₱$,\s]|php/gi, ""); return s; }

/** Rebuild rows using MenuWise keys. Unmapped extra columns are dropped. */
export function applyMapping(rows: Row[], mapping: Mapping, numeric: string[] = []): Row[] {
  return rows.map((row) => {
    const out: Row = { __line: row.__line };
    const src = new Map(Object.entries(row).map(([k, v]) => [keyOf(k), v]));
    for (const [field, m] of Object.entries(mapping)) {
      let v = m.column ? (src.get(keyOf(m.column)) ?? "") : "";
      if (!String(v).trim() && m.fixed) v = m.fixed;
      v = String(v ?? "").trim();
      out[field] = numeric.includes(field) && v ? cleanNumber(v) : v;
    }
    return out;
  });
}
