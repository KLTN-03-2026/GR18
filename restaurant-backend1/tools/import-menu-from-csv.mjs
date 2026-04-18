import fs from "node:fs";
import path from "node:path";

const API_BASE = process.env.API_BASE || "http://localhost:8080/api";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || "";
const CSV_PATH = process.env.CSV_PATH || path.resolve("tools/menu_sheet1_utf8.csv");
const IMAGE_DIR = process.env.IMAGE_DIR || path.resolve("Image");
const DRY_RUN = String(process.env.DRY_RUN || "true").toLowerCase() !== "false";
const MAX_ITEMS = Number(process.env.MAX_ITEMS || "0"); // 0 = all
const AUTO_CREATE_CATEGORIES = String(process.env.AUTO_CREATE_CATEGORIES || "true").toLowerCase() !== "false";
const CATEGORY_ID_BY_RANGE = {
  KHAI_VI: Number(process.env.CAT_ID_KHAI_VI || "13"),
  SALAD: Number(process.env.CAT_ID_SALAD || "2"),
  SUSHI: Number(process.env.CAT_ID_SUSHI || "5"),
  SASHIMI: Number(process.env.CAT_ID_SASHIMI || "6"),
  THIT_THUONG_HANG: Number(process.env.CAT_ID_THIT_THUONG_HANG || "14"),
  HAI_SAN: Number(process.env.CAT_ID_HAI_SAN || "15"),
  TRANG_MIENG: Number(process.env.CAT_ID_TRANG_MIENG || "16"),
  COMBO: Number(process.env.CAT_ID_COMBO || "4"),
  NUOC_UONG: Number(process.env.CAT_ID_NUOC_UONG || "17"),
};

const CATEGORY_ALIAS = {
  "món ăn phụ": "Khai Vị",
  "salad": "Salad",
  "sushi": "Sushi",
  "sashimi": "Sashimi",
  "thịt thượng hạng": "Thịt thượng hạng",
  "hải sản": "Hải sản",
  "tráng miệng": "Tráng miệng",
  "combo": "Combo",
  "nước uống": "Nước uống",
};

const STT_CATEGORY_RANGES = [
  { from: 1, to: 20, name: "Khai Vị", key: "KHAI_VI" },
  { from: 21, to: 39, name: "Salad", key: "SALAD" },
  { from: 40, to: 89, name: "Sushi", key: "SUSHI" },
  { from: 90, to: 121, name: "Sashimi", key: "SASHIMI" },
  { from: 122, to: 134, name: "Thịt thượng hạng", key: "THIT_THUONG_HANG" },
  { from: 135, to: 145, name: "Hải sản", key: "HAI_SAN" },
  { from: 146, to: 153, name: "Tráng miệng", key: "TRANG_MIENG" },
  { from: 154, to: 157, name: "Combo", key: "COMBO" },
  { from: 158, to: 171, name: "Nước uống", key: "NUOC_UONG" },
];

if (!ACCESS_TOKEN) {
  console.error("Missing ACCESS_TOKEN environment variable.");
  process.exit(1);
}
if (!fs.existsSync(CSV_PATH)) {
  console.error("CSV file not found:", CSV_PATH);
  process.exit(1);
}
if (!fs.existsSync(IMAGE_DIR)) {
  console.error("Image directory not found:", IMAGE_DIR);
  process.exit(1);
}

function normalize(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (c === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += c;
  }
  result.push(current);
  return result.map((s) => s.trim());
}

function parsePrice(raw) {
  const cleaned = String(raw || "").replace(/[^\d]/g, "");
  return cleaned ? Number(cleaned) : 0;
}

function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    ...extra,
  };
}

async function getJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url} -> ${text}`);
  }
  return json;
}

async function loadCategories() {
  const json = await getJson(`${API_BASE}/admin/categories`, {
    headers: authHeaders(),
  });
  const list = json?.data || [];
  const map = new Map();
  for (const c of list) {
    map.set(normalize(c.name), c.id);
  }
  return { list, map };
}

async function refreshCategoryMap(categoryMap) {
  const json = await getJson(`${API_BASE}/admin/categories`, {
    headers: authHeaders(),
  });
  const list = json?.data || [];
  for (const c of list) {
    categoryMap.set(normalize(c.name), c.id);
  }
}

function inferCategoryByStt(sttValue) {
  const stt = Number(String(sttValue || "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(stt) || stt <= 0) return "";
  const hit = STT_CATEGORY_RANGES.find((r) => stt >= r.from && stt <= r.to);
  return hit ? hit.name : "";
}

function inferCategoryIdByStt(sttValue) {
  const stt = Number(String(sttValue || "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(stt) || stt <= 0) return null;
  const hit = STT_CATEGORY_RANGES.find((r) => stt >= r.from && stt <= r.to);
  if (!hit) return null;
  const id = CATEGORY_ID_BY_RANGE[hit.key];
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function ensureCategoryId(rawName, categoryMap) {
  const alias = CATEGORY_ALIAS[normalize(rawName)] || rawName;
  const key = normalize(alias);
  const existing = categoryMap.get(key);
  if (existing) return existing;

  if (!AUTO_CREATE_CATEGORIES || DRY_RUN) return null;
  if (!alias || !alias.trim()) return null;

  const body = {
    name: alias.trim(),
    description: alias.trim(),
    imageUrl: "",
    sortOrder: 0,
  };
  let json;
  try {
    json = await getJson(`${API_BASE}/admin/categories`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
  } catch (e) {
    // Category co the da ton tai trong DB nhung map hien tai chua co -> refresh map bat ke thong diep loi.
    try {
      await refreshCategoryMap(categoryMap);
      const refound = categoryMap.get(key);
      if (refound) return refound;
    } catch (e2) {
      console.warn(`[WARN] Refresh categories failed: ${e2.message}`);
    }
    console.warn(`[WARN] Cannot create category "${alias}": ${e.message}`);
    return null;
  }
  const id = json?.data?.id;
  if (id) {
    categoryMap.set(key, id);
    console.log(`[CAT] Created category "${alias}" -> id=${id}`);
    return id;
  }
  return null;
}

function detectMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

async function loadExistingMenuNames() {
  const json = await getJson(`${API_BASE}/admin/menu-items`, {
    headers: authHeaders(),
  });
  const list = json?.data || [];
  const set = new Set(list.map((x) => normalize(x.name)));
  return set;
}

function buildImageIndex() {
  const files = fs.readdirSync(IMAGE_DIR).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  const byNormalizedName = new Map();
  const byNumericName = new Map();
  for (const file of files) {
    const abs = path.join(IMAGE_DIR, file);
    const base = path.parse(file).name;
    byNormalizedName.set(normalize(base), abs);
    if (/^\d+$/.test(base)) byNumericName.set(base, abs);
  }
  return { byNormalizedName, byNumericName };
}

function resolveImagePath(imgValue, dishName, imageIndex) {
  const imgKey = String(imgValue || "").trim();
  if (imgKey && imageIndex.byNumericName.has(imgKey)) {
    return imageIndex.byNumericName.get(imgKey);
  }
  const nameKey = normalize(dishName);
  if (imageIndex.byNormalizedName.has(nameKey)) {
    return imageIndex.byNormalizedName.get(nameKey);
  }
  return null;
}

async function uploadImage(imagePath) {
  const bytes = fs.readFileSync(imagePath);
  const fileName = path.basename(imagePath);
  const mimeType = detectMimeType(fileName);
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mimeType }), fileName);
  const json = await getJson(`${API_BASE}/admin/menu-items/upload-image`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  const url = json?.data?.imageUrl;
  if (!url) throw new Error(`Upload success response missing imageUrl for ${fileName}`);
  return url;
}

async function createMenuItem(payload) {
  return getJson(`${API_BASE}/admin/menu-items`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

async function main() {
  const content = fs.readFileSync(CSV_PATH, "utf8");
  const lines = content.split(/\r?\n/).filter((x) => x.trim().length > 0);
  const rows = lines.slice(1).map(parseCsvLine); // skip header

  const { map: categoryMap } = await loadCategories();
  const existingNames = await loadExistingMenuNames();
  const imageIndex = buildImageIndex();

  let currentCategoryRaw = "";
  let created = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;

  for (const r of rows) {
    if (r.length < 6) continue;
    const sttRaw = r[0] || "";
    const categoryRaw = r[1] || "";
    const dishName = (r[2] || "").trim();
    const priceRaw = r[4] || "";
    const imgRaw = r[5] || "";

    if (!dishName) continue;
    if (categoryRaw) currentCategoryRaw = categoryRaw;
    if (!currentCategoryRaw) {
      currentCategoryRaw = inferCategoryByStt(sttRaw);
    }
    const alias = CATEGORY_ALIAS[normalize(currentCategoryRaw)] || currentCategoryRaw;
    let categoryId = await ensureCategoryId(alias, categoryMap);
    if (!categoryId) {
      categoryId = inferCategoryIdByStt(sttRaw);
    }
    const price = parsePrice(priceRaw);

    if (!categoryId) {
      console.warn(`[SKIP] Missing category mapping for "${currentCategoryRaw}" -> alias "${alias}" | dish "${dishName}"`);
      skipped++;
      continue;
    }
    if (!price || price <= 0) {
      console.warn(`[SKIP] Invalid price "${priceRaw}" | dish "${dishName}"`);
      skipped++;
      continue;
    }
    if (existingNames.has(normalize(dishName))) {
      console.log(`[SKIP] Already exists "${dishName}"`);
      skipped++;
      continue;
    }

    let imageUrl = null;
    const imagePath = resolveImagePath(imgRaw, dishName, imageIndex);
    if (imagePath) {
      try {
        imageUrl = DRY_RUN ? `[DRY_RUN] ${path.basename(imagePath)}` : await uploadImage(imagePath);
      } catch (e) {
        console.warn(`[WARN] Upload image failed for "${dishName}": ${e.message}`);
      }
    } else {
      console.warn(`[WARN] No image found for "${dishName}" (Img=${imgRaw || "empty"})`);
    }

    const payload = {
      categoryId,
      name: dishName,
      description: "",
      price,
      imageUrl: imageUrl || undefined,
    };

    if (DRY_RUN) {
      console.log(`[DRY] Would create: ${JSON.stringify(payload)}`);
      created++;
    } else {
      try {
        await createMenuItem(payload);
        console.log(`[OK] Created "${dishName}"`);
        existingNames.add(normalize(dishName));
        created++;
      } catch (e) {
        console.error(`[FAIL] "${dishName}" -> ${e.message}`);
        failed++;
      }
    }

    processed++;
    if (MAX_ITEMS > 0 && processed >= MAX_ITEMS) break;
  }

  console.log("----- SUMMARY -----");
  console.log("DRY_RUN:", DRY_RUN);
  console.log("created:", created);
  console.log("skipped:", skipped);
  console.log("failed:", failed);
}

main().catch((e) => {
  console.error("Import failed:", e);
  process.exit(1);
});
