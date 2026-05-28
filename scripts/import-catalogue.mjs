/**
 * Catalogue import — hydrates the Supabase products table from a CSV.
 *
 * Two CSV shapes are detected from the header row:
 *   - "inventory"   — Product;Catagory;Gold/Silver;Sellng Price;Qty;Product Photo
 *                     (note the typos: those header strings come straight from
 *                     the merchant's spreadsheet; do not "correct" them)
 *   - "description" — Product Name;Description;Material;Length/Size;Image Filename
 *
 * Inventory rows update price, quantity, category, metal and image_url on
 * matching products. Description rows update description and append to the
 * images array. New categories are created on demand; new products are NOT
 * — they must already exist in the table (insert them via Supabase Studio
 * first, then run this to fill in inventory/copy).
 *
 * Run:
 *   node scripts/import-catalogue.mjs path/to/file.csv
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local. Falls back to anon key
 * if missing, but anon will silently fail any write that's blocked by RLS.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const argv = process.argv.slice(2);
if (argv.length !== 1) {
    console.error("Usage: node scripts/import-catalogue.mjs <csv-file>");
    process.exit(1);
}

const csvPath = path.resolve(process.cwd(), argv[0]);
if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
}

const env = loadEnv(path.resolve(process.cwd(), ".env.local"), path.resolve(process.cwd(), ".env"));
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error(
        "Missing Supabase credentials. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) are set in .env.local or .env.",
    );
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
});

const raw = fs.readFileSync(csvPath, "utf8").trim();
const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
if (lines.length === 0) {
    console.error("CSV file is empty.");
    process.exit(1);
}

const delimiter = detectDelimiter(lines[0]);
const header = parseCsvLine(lines[0], delimiter).map((h) => normalizeHeader(h));
const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    return header.reduce((acc, key, idx) => {
        acc[key] = values[idx] ?? "";
        return acc;
    }, {});
});

const importMode = detectImportMode(header);
console.log(`Detected import mode: ${importMode}`);

if (importMode === "inventory") {
    await importInventory(rows);
} else if (importMode === "description") {
    await importDescriptions(rows);
} else {
    console.error("Unable to detect CSV type. Expected inventory or description CSV.");
    process.exit(1);
}

console.log("Import complete.");
process.exit(0);

function loadEnv(...paths) {
    const result = {};
    for (const envPath of paths) {
        if (!fs.existsSync(envPath)) continue;
        const content = fs.readFileSync(envPath, "utf8");
        for (const rawLine of content.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith("#") || !line.includes("=")) continue;
            const [key, ...rest] = line.split("=");
            result[key.trim()] = rest.join("=").trim();
        }
    }
    return result;
}

function normalizeHeader(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, " ")
        .replace(/[^a-z0-9 ]/g, "");
}

function parseCsvLine(line, delimiter) {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (!inQuotes && char === delimiter) {
            values.push(current);
            current = "";
            continue;
        }
        current += char;
    }
    values.push(current);
    return values.map((value) => value.trim());
}

function detectDelimiter(firstLine) {
    if (firstLine.includes(";") && !firstLine.includes(",")) return ";";
    if (firstLine.includes(",") && !firstLine.includes(";")) return ",";
    return firstLine.includes(";") ? ";" : ",";
}

function detectImportMode(header) {
    if (header.includes("product photo") && header.includes("product") && header.includes("catagory")) {
        return "inventory";
    }
    if (header.includes("product name") && header.includes("description") && header.includes("image filename")) {
        return "description";
    }
    return "unknown";
}

function normalizeName(value) {
    return value.trim().replace(/\s+/g, " ");
}

function normalizeMetal(value) {
    const raw = value.trim().toLowerCase();
    if (raw === "gold") return "gold";
    if (raw === "silver") return "silver";
    if (raw === "rose gold" || raw === "rose_gold" || raw === "rosegold") return "rose_gold";
    if (raw === "white gold" || raw === "white_gold" || raw === "whitegold") return "white_gold";
    if (raw === "platinum") return "platinum";
    return null;
}

function parsePrice(value) {
    if (!value) return null;
    const cleaned = value.replace(/[R,$\s]/gi, "").replace(/,/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseQuantity(value) {
    const cleaned = value.trim().replace(/[^0-9\-]/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCategorySlug(value) {
    if (!value) return null;
    const raw = value.trim().toLowerCase();
    if (raw.includes("jewellery")) return "jewellery-boxes";
    return raw.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function categoryDisplayName(slug) {
    if (!slug) return null;
    return slug.replace(/-/g, " ").replace(/\b\w/g, (chr) => chr.toUpperCase());
}

async function importInventory(rows) {
    for (const row of rows) {
        const productName = normalizeName(row["product"] ?? row["product name"] ?? "");
        const categoryValue = row["catagory"] ?? row["category"] ?? "";
        const metalValue = row["gold/silver"] ?? row["metal"] ?? "";
        const priceValue = row["sellng price"] ?? row["selling price"] ?? row["price"] ?? "";
        const qtyValue = row["qty"] ?? row["quantity"] ?? "";
        const photoUrl = row["product photo"] ?? "";

        if (!productName) {
            console.warn("Skipping row without product name", row);
            continue;
        }

        const categorySlug = normalizeCategorySlug(categoryValue) ?? "";
        const metal = normalizeMetal(metalValue);
        const price = parsePrice(priceValue);
        const quantity = parseQuantity(qtyValue);

        let categoryId = null;
        if (categorySlug) {
            const { data: categories, error: catError } = await supabase
                .from("categories")
                .select("id")
                .eq("slug", categorySlug)
                .limit(1);
            if (catError) {
                console.error("Failed to query categories", catError);
                continue;
            }
            if (categories?.length > 0) {
                categoryId = categories[0].id;
            } else {
                const name = categoryDisplayName(categorySlug) ?? categoryValue;
                const { data: inserted, error: insertError } = await supabase
                    .from("categories")
                    .insert({ name, slug: categorySlug })
                    .select("id")
                    .single();
                if (insertError) {
                    console.error("Failed to insert category", categorySlug, insertError);
                    continue;
                }
                categoryId = inserted.id;
                console.log(`Created category ${categorySlug}`);
            }
        }

        const query = supabase.from("products").select("id,name,slug,metal,category_id,images,image_url");
        if (metal) query.eq("metal", metal);
        if (productName) query.ilike("name", productName);
        const { data: productRecords, error: fetchError } = await query;
        if (fetchError) {
            console.error("Failed to query product", productName, fetchError);
            continue;
        }
        if (!productRecords || productRecords.length === 0) {
            console.warn(`No product found for name='${productName}' metal='${metal ?? "<any>"}'`);
            continue;
        }

        for (const product of productRecords) {
            const updated = {};
            if (typeof quantity === "number") {
                updated.quantity = quantity;
                updated.in_stock = quantity > 0;
            }
            if (typeof price === "number") {
                updated.price = price;
            }
            if (categoryId) updated.category_id = categoryId;
            if (metal) updated.metal = metal;
            if (photoUrl && !product.image_url) updated.image_url = photoUrl;

            if (photoUrl) {
                const existingImages = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
                const normalizedImages = Array.from(new Set([...existingImages, photoUrl]));
                updated.images = normalizedImages;
            }

            if (Object.keys(updated).length === 0) {
                console.log(`Nothing to update for ${productName} (${product.id})`);
                continue;
            }

            const { error: updateError } = await supabase
                .from("products")
                .update(updated)
                .eq("id", product.id);
            if (updateError) {
                console.error("Failed to update product", product.id, updateError);
            } else {
                console.log(`Updated product ${productName} (${product.id})`);
            }
        }
    }
}

async function importDescriptions(rows) {
    for (const row of rows) {
        const productName = normalizeName(row["product name"] ?? "");
        const description = row["description"]?.trim() ?? "";
        const imageFilename = row["image filename"]?.trim() ?? "";

        if (!productName) {
            console.warn("Skipping row without product name", row);
            continue;
        }

        const { data: products, error: fetchError } = await supabase
            .from("products")
            .select("id,name,images")
            .ilike("name", productName);

        if (fetchError) {
            console.error("Failed to query products for description import", fetchError);
            continue;
        }
        if (!products || products.length === 0) {
            console.warn(`No products found for description import: '${productName}'`);
            continue;
        }

        for (const product of products) {
            const updated = {};
            if (description) updated.description = description;
            if (imageFilename) {
                const existingImages = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
                updated.images = Array.from(new Set([...existingImages, imageFilename]));
            }

            if (Object.keys(updated).length === 0) {
                console.log(`Nothing to update for ${productName} (${product.id})`);
                continue;
            }

            const { error: updateError } = await supabase
                .from("products")
                .update(updated)
                .eq("id", product.id);
            if (updateError) {
                console.error("Failed to update product", product.id, updateError);
            } else {
                console.log(`Updated product ${productName} (${product.id})`);
            }
        }
    }
}
