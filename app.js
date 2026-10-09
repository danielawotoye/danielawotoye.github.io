/* ============================================================
   Haul: plan your move
   ------------------------------------------------------------
   All the "rules of thumb" live in the CONSTANTS section right
   below. They're estimates. Tweak them to make the plan smarter
   without touching the logic further down.
   ============================================================ */

/* ================= CONSTANTS (tune these) ================= */

// Extra boxes on top of the estimate, because everyone underestimates.
const BOX_BUFFER = 0.15; // 15%

// Box sizes: how much truck space each takes and how long it takes to pack.
const BOX_SIZES = {
  small:    { label: "Small box",    cuFt: 1.5, packMin: 12 },
  medium:   { label: "Medium box",   cuFt: 3.0, packMin: 15 },
  large:    { label: "Large box",    cuFt: 4.5, packMin: 18 },
  wardrobe: { label: "Wardrobe box", cuFt: 10,  packMin: 10 },
};

// Room types.
//   boxes:    total boxes for a light / medium / packed room
//   mix:      share of those boxes in each size (adds up to 1)
//   priority: packing order. 1 = pack first (least used), 5 = pack last
//   fragile:  needs packing paper / bubble wrap
const ROOM_TYPES = {
  closet:   { label: "Closet / storage", boxes: { light: 3, medium: 6,  packed: 10 }, mix: { small: 0.1, medium: 0.3, large: 0.3, wardrobe: 0.3 }, priority: 1, fragile: false },
  garage:   { label: "Garage",           boxes: { light: 4, medium: 8,  packed: 14 }, mix: { small: 0.3, medium: 0.4, large: 0.3, wardrobe: 0 },   priority: 1, fragile: false },
  living:   { label: "Living room",      boxes: { light: 4, medium: 8,  packed: 12 }, mix: { small: 0.3, medium: 0.4, large: 0.3, wardrobe: 0 },   priority: 2, fragile: true  },
  office:   { label: "Office / study",   boxes: { light: 3, medium: 6,  packed: 10 }, mix: { small: 0.4, medium: 0.4, large: 0.2, wardrobe: 0 },   priority: 2, fragile: true  },
  dining:   { label: "Dining room",      boxes: { light: 2, medium: 4,  packed: 7  }, mix: { small: 0.5, medium: 0.4, large: 0.1, wardrobe: 0 },   priority: 2, fragile: true  },
  bedroom:  { label: "Bedroom",          boxes: { light: 6, medium: 10, packed: 15 }, mix: { small: 0.2, medium: 0.4, large: 0.3, wardrobe: 0.1 }, priority: 3, fragile: false },
  dorm:     { label: "Dorm room",        boxes: { light: 4, medium: 7,  packed: 10 }, mix: { small: 0.3, medium: 0.4, large: 0.2, wardrobe: 0.1 }, priority: 3, fragile: false },
  kitchen:  { label: "Kitchen",          boxes: { light: 5, medium: 10, packed: 15 }, mix: { small: 0.5, medium: 0.4, large: 0.1, wardrobe: 0 },   priority: 4, fragile: true  },
  bathroom: { label: "Bathroom",         boxes: { light: 1, medium: 2,  packed: 4  }, mix: { small: 0.7, medium: 0.3, large: 0,   wardrobe: 0 },   priority: 5, fragile: false },
};

// Typical rooms for each kind of place (used by "Use typical rooms").
const TYPICAL_ROOMS = {
  dorm:      [["dorm", "medium"]],
  apartment: [["bedroom", "medium"], ["kitchen", "medium"], ["living", "medium"], ["bathroom", "light"], ["closet", "light"]],
  house:     [["bedroom", "packed"], ["bedroom", "medium"], ["kitchen", "packed"], ["living", "medium"], ["dining", "light"], ["bathroom", "medium"], ["closet", "medium"], ["garage", "medium"]],
};

// Big furniture.
//   cuFt:     truck space it takes
//   prepMin:  minutes to take apart / wrap before the move
//   loadMin:  person-minutes to carry it out (and again to carry it in)
//   blankets: moving blankets to protect it
//   heavy:    needs at least two people
const FURNITURE = {
  bed:        { label: "Bed (frame + mattress)", cuFt: 60, prepMin: 30, loadMin: 20, blankets: 1, heavy: true  },
  couch:      { label: "Couch",                  cuFt: 50, prepMin: 10, loadMin: 25, blankets: 2, heavy: true  },
  armchair:   { label: "Armchair",               cuFt: 20, prepMin: 0,  loadMin: 8,  blankets: 1, heavy: false },
  desk:       { label: "Desk",                   cuFt: 25, prepMin: 20, loadMin: 12, blankets: 1, heavy: false },
  dresser:    { label: "Dresser",                cuFt: 30, prepMin: 5,  loadMin: 20, blankets: 1, heavy: true  },
  nightstand: { label: "Nightstand",             cuFt: 6,  prepMin: 0,  loadMin: 4,  blankets: 0, heavy: false },
  bookshelf:  { label: "Bookshelf",              cuFt: 20, prepMin: 15, loadMin: 10, blankets: 1, heavy: false },
  table:      { label: "Dining table",           cuFt: 30, prepMin: 20, loadMin: 15, blankets: 1, heavy: true  },
  chair:      { label: "Chair",                  cuFt: 6,  prepMin: 0,  loadMin: 3,  blankets: 0, heavy: false },
  tv:         { label: "TV",                     cuFt: 10, prepMin: 10, loadMin: 6,  blankets: 1, heavy: false },
  minifridge: { label: "Mini fridge",            cuFt: 8,  prepMin: 0,  loadMin: 6,  blankets: 0, heavy: false },
};

// Person-minutes to carry one box out (unloading takes about the same).
const LOAD_MIN_PER_BOX = 1.5;

// Supplies. "pack" = how many come in one purchase. Prices are rough
// big-box-store estimates; users can edit them in the Supplies tab.
const SUPPLIES = {
  small:    { label: "Small boxes",          pack: 10, price: 20 },
  medium:   { label: "Medium boxes",         pack: 10, price: 25 },
  large:    { label: "Large boxes",          pack: 10, price: 30 },
  wardrobe: { label: "Wardrobe boxes",       pack: 1,  price: 18 },
  tape:     { label: "Packing tape (rolls)", pack: 6,  price: 18 },
  paper:    { label: "Packing paper bundle", pack: 1,  price: 20 },
  bubble:   { label: "Bubble wrap roll",     pack: 1,  price: 16 },
  markers:  { label: "Markers",              pack: 4,  price: 6  },
  blankets: { label: "Moving blankets",      pack: 6,  price: 35 },
  stretch:  { label: "Stretch wrap roll",    pack: 1,  price: 15 },
};
const BOXES_PER_TAPE_ROLL = 12;
const FRAGILE_BOXES_PER_PAPER = 15;
const FRAGILE_BOXES_PER_BUBBLE = 20;

// Vehicles: usable cargo space and a rough day rate (before mileage).
const VEHICLES = [
  { label: "Your car",     cuFt: 30,   rate: 0 },
  { label: "SUV",          cuFt: 60,   rate: 0 },
  { label: "Cargo van",    cuFt: 250,  rate: 40 },
  { label: "10 ft truck",  cuFt: 400,  rate: 30 },
  { label: "15 ft truck",  cuFt: 760,  rate: 40 },
  { label: "20 ft truck",  cuFt: 1000, rate: 50 },
  { label: "26 ft truck",  cuFt: 1680, rate: 60 },
];
// Boxes and furniture never pack perfectly. Need this much more space than the raw total.
const LOADING_SLACK = 1.2;
// Anything this big won't fit in a car or SUV.
const CAR_MAX_ITEM_CUFT = 20;

// New-place setup items.
//   scope: "each" = every person needs their own; "shared" = one for the place
//   notDorm: skip when moving into a dorm
const SETUP_ITEMS = {
  night1: {
    label: "Night 1",
    note: "Pack these in a separate bag so you're not digging through boxes at midnight.",
    items: [
      { id: "sheets",   label: "Sheets and pillow",         scope: "each",   price: 40 },
      { id: "towel",    label: "Towel",                     scope: "each",   price: 15 },
      { id: "toiletries", label: "Toiletries",              scope: "each",   price: 15 },
      { id: "charger",  label: "Phone charger and power strip", scope: "each", price: 15 },
      { id: "tp",       label: "Toilet paper",              scope: "shared", price: 10 },
      { id: "trash",    label: "Trash bags and paper towels", scope: "shared", price: 12 },
      { id: "curtain",  label: "Shower curtain and rings",  scope: "shared", price: 20, notDorm: true },
      { id: "tools",    label: "Box cutter and basic tools", scope: "shared", price: 15 },
    ],
  },
  week1: {
    label: "Week 1",
    note: "The stuff you'll notice is missing within a few days.",
    items: [
      { id: "cleaning", label: "Cleaning supplies",         scope: "shared", price: 25 },
      { id: "hangers",  label: "Hangers",                   scope: "each",   price: 12 },
      { id: "laundry",  label: "Laundry basket and detergent", scope: "each", price: 20 },
      { id: "firstaid", label: "First-aid kit",             scope: "shared", price: 15 },
      { id: "dishes",   label: "Plates, bowls, utensils",   scope: "shared", price: 40, notDorm: true },
      { id: "pans",     label: "Pot and pan",               scope: "shared", price: 50, notDorm: true },
      { id: "bulbs",    label: "Light bulbs",               scope: "shared", price: 12, notDorm: true },
      { id: "router",   label: "Wi-Fi router",              scope: "shared", price: 80, notDorm: true },
    ],
  },
  month1: {
    label: "Month 1",
    note: "Makes the place livable. No rush.",
    items: [
      { id: "lamp",     label: "Desk lamp",                 scope: "each",   price: 25 },
      { id: "bins",     label: "Storage bins",              scope: "each",   price: 30 },
      { id: "rug",      label: "Rug",                       scope: "shared", price: 60 },
      { id: "curtains", label: "Curtains or blinds",        scope: "shared", price: 35, notDorm: true },
      { id: "microwave", label: "Microwave or kettle",      scope: "shared", price: 45 },
    ],
  },
};

const STORAGE_KEY = "haul-plan-v1";

/* ================= STATE ================= */

function defaultState() {
  const d = new Date();
  d.setDate(d.getDate() + 21);
  return {
    moveDate: toISODate(d),
    fromType: "apartment",
    toType: "apartment",
    freeHours: 2,
    driveHours: 0.5,
    helpers: 2,
    rooms: makeTypicalRooms("apartment"),
    furniture: { bed: 1, desk: 1, dresser: 1, couch: 1, nightstand: 1 },
    prices: {},          // user overrides for supply prices
    showMath: false,
    roommates: [],       // names, not including "you"
    setup: {},           // itemId -> { have: bool, who: "split" | "me" | name }
    tab: "supplies",
  };
}

let nextRoomId = 1;
function makeTypicalRooms(placeType) {
  return TYPICAL_ROOMS[placeType].map(([type, fullness]) => ({ id: nextRoomId++, type, fullness }));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const saved = JSON.parse(raw);
    const merged = Object.assign(defaultState(), saved);
    // keep room ids unique after a reload
    nextRoomId = merged.rooms.reduce((m, r) => Math.max(m, r.id), 0) + 1;
    return merged;
  } catch (e) {
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    /* storage blocked (private window, etc.): the app still works, it just won't remember */
  }
}

let state = loadState();

/* ================= HELPERS ================= */

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfToday() {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

function addDays(d, n) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

const money = (n) => "$" + Math.round(n).toLocaleString();
const hrs = (min) => {
  const h = min / 60;
  return (h < 10 ? Math.round(h * 10) / 10 : Math.round(h)) + " hr" + (h === 1 ? "" : "s");
};
const fmtDay = (d) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const IRREGULAR = { box: "boxes", person: "people" };
const plural = (n, word) => `${n} ${n === 1 ? word : IRREGULAR[word] || word + "s"}`;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function priceOf(key) {
  const p = state.prices[key];
  return typeof p === "number" && p >= 0 ? p : SUPPLIES[key].price;
}

/* ================= THE ENGINE ================= */

// Split a room's box total into sizes so the pieces add back up exactly.
function splitBoxes(total, mix) {
  const sizes = Object.keys(BOX_SIZES);
  const exact = sizes.map((s) => total * (mix[s] || 0));
  const counts = exact.map(Math.floor);
  let left = total - counts.reduce((a, b) => a + b, 0);
  // hand leftover boxes to the sizes with the biggest remainders
  const order = exact.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < left; k++) counts[order[k % order.length][1]]++;
  const out = {};
  sizes.forEach((s, i) => (out[s] = counts[i]));
  return out;
}

function computePlan() {
  // ---- 1. Boxes per room ----
  const roomBoxes = state.rooms.map((room) => {
    const type = ROOM_TYPES[room.type];
    const total = type.boxes[room.fullness];
    return { room, type, total, sizes: splitBoxes(total, type.mix) };
  });

  const raw = { small: 0, medium: 0, large: 0, wardrobe: 0 };
  let fragileBoxes = 0;
  roomBoxes.forEach((rb) => {
    Object.keys(raw).forEach((s) => (raw[s] += rb.sizes[s]));
    if (rb.type.fragile) fragileBoxes += rb.total;
  });

  // ---- 2. Add the buffer, then round up to whole packs ----
  const withBuffer = {};
  Object.keys(raw).forEach((s) => (withBuffer[s] = Math.ceil(raw[s] * (1 + BOX_BUFFER))));
  const totalBoxes = Object.values(withBuffer).reduce((a, b) => a + b, 0);
  const rawTotal = Object.values(raw).reduce((a, b) => a + b, 0);

  const supplyLines = [];
  Object.keys(raw).forEach((s) => {
    if (withBuffer[s] === 0) return;
    const sup = SUPPLIES[s];
    const packs = Math.ceil(withBuffer[s] / sup.pack);
    supplyLines.push({
      key: s, label: sup.label, need: withBuffer[s], packs, buyQty: packs * sup.pack, unit: sup.pack,
      cost: packs * priceOf(s),
      math: `${raw[s]} from your rooms + ${Math.round(BOX_BUFFER * 100)}% buffer = ${raw[s]} × ${1 + BOX_BUFFER} = ${(raw[s] * (1 + BOX_BUFFER)).toFixed(1)}, round up to ${withBuffer[s]}. ` +
            `Sold in ${sup.pack}s: ${withBuffer[s]} ÷ ${sup.pack} = ${(withBuffer[s] / sup.pack).toFixed(2)}, round up to ${packs} pack${packs === 1 ? "" : "s"}.`,
    });
  });

  // tape, paper, bubble wrap, markers
  if (totalBoxes > 0) {
    const rolls = Math.ceil(totalBoxes / BOXES_PER_TAPE_ROLL);
    const packs = Math.ceil(rolls / SUPPLIES.tape.pack);
    supplyLines.push({
      key: "tape", label: SUPPLIES.tape.label, need: rolls, packs, buyQty: packs * SUPPLIES.tape.pack, unit: SUPPLIES.tape.pack,
      cost: packs * priceOf("tape"),
      math: `1 roll per ${BOXES_PER_TAPE_ROLL} boxes: ${totalBoxes} ÷ ${BOXES_PER_TAPE_ROLL} = ${(totalBoxes / BOXES_PER_TAPE_ROLL).toFixed(1)}, round up to ${rolls} rolls. Sold in ${SUPPLIES.tape.pack}s, so ${packs} pack${packs === 1 ? "" : "s"}.`,
    });
  }
  if (fragileBoxes > 0) {
    const paper = Math.ceil(fragileBoxes / FRAGILE_BOXES_PER_PAPER);
    supplyLines.push({
      key: "paper", label: SUPPLIES.paper.label, need: paper, packs: paper, buyQty: paper, unit: 1,
      cost: paper * priceOf("paper"),
      math: `${fragileBoxes} boxes from rooms with breakables (kitchen, living, dining, office). 1 bundle per ${FRAGILE_BOXES_PER_PAPER}: ${fragileBoxes} ÷ ${FRAGILE_BOXES_PER_PAPER}, round up to ${paper}.`,
    });
    const bubble = Math.ceil(fragileBoxes / FRAGILE_BOXES_PER_BUBBLE);
    supplyLines.push({
      key: "bubble", label: SUPPLIES.bubble.label, need: bubble, packs: bubble, buyQty: bubble, unit: 1,
      cost: bubble * priceOf("bubble"),
      math: `1 roll per ${FRAGILE_BOXES_PER_BUBBLE} breakable boxes: ${fragileBoxes} ÷ ${FRAGILE_BOXES_PER_BUBBLE}, round up to ${bubble}.`,
    });
  }
  if (totalBoxes > 0) {
    supplyLines.push({
      key: "markers", label: SUPPLIES.markers.label, need: 1, packs: 1, buyQty: SUPPLIES.markers.pack, unit: SUPPLIES.markers.pack,
      cost: priceOf("markers"), math: "One pack covers labeling every box with its room.",
    });
  }

  // furniture protection
  let blanketsNeeded = 0;
  let furnitureCount = 0;
  let heavyCount = 0;
  let furnitureCuFt = 0;
  let furniturePrepMin = 0;
  let furnitureLoadMin = 0;
  let biggestItem = 0;
  Object.entries(state.furniture).forEach(([key, n]) => {
    const f = FURNITURE[key];
    if (!f || !n) return;
    furnitureCount += n;
    blanketsNeeded += f.blankets * n;
    if (f.heavy) heavyCount += n;
    furnitureCuFt += f.cuFt * n;
    furniturePrepMin += f.prepMin * n;
    furnitureLoadMin += f.loadMin * n;
    biggestItem = Math.max(biggestItem, f.cuFt);
  });
  if (blanketsNeeded > 0) {
    const packs = Math.ceil(blanketsNeeded / SUPPLIES.blankets.pack);
    supplyLines.push({
      key: "blankets", label: SUPPLIES.blankets.label, need: blanketsNeeded, packs, buyQty: packs * SUPPLIES.blankets.pack, unit: SUPPLIES.blankets.pack,
      cost: packs * priceOf("blankets"),
      math: `${blanketsNeeded} blanket${blanketsNeeded === 1 ? "" : "s"} for your furniture (couches take 2). Sold in ${SUPPLIES.blankets.pack}s, so ${packs} pack${packs === 1 ? "" : "s"}.`,
    });
  }
  if (furnitureCount > 0) {
    supplyLines.push({
      key: "stretch", label: SUPPLIES.stretch.label, need: 1, packs: 1, buyQty: 1, unit: 1,
      cost: priceOf("stretch"), math: "One roll keeps drawers shut and blankets on.",
    });
  }

  const suppliesCost = supplyLines.reduce((a, l) => a + l.cost, 0);

  // ---- 3. Truck space ----
  let boxCuFt = 0;
  Object.keys(withBuffer).forEach((s) => (boxCuFt += raw[s] * BOX_SIZES[s].cuFt));
  const stuffCuFt = boxCuFt + furnitureCuFt;
  const neededCuFt = stuffCuFt * LOADING_SLACK;
  const carOk = biggestItem <= CAR_MAX_ITEM_CUFT;
  let vehicle = VEHICLES.find((v) => v.cuFt >= neededCuFt && (carOk || v.cuFt > 60));
  const tripsNeeded = vehicle ? 1 : Math.ceil(neededCuFt / VEHICLES[VEHICLES.length - 1].cuFt);
  if (!vehicle) vehicle = VEHICLES[VEHICLES.length - 1];

  // ---- 4. People and move-day time ----
  let people = 1;
  if (heavyCount > 0 || rawTotal > 25) people = 2;
  if (neededCuFt > 400) people = 3;
  if (neededCuFt > 900) people = 4;
  const loadPersonMin = rawTotal * LOAD_MIN_PER_BOX + furnitureLoadMin;
  const crew = Math.max(1, state.helpers);
  const carryMin = (loadPersonMin * 2) / crew; // load + unload
  const driveMin = state.driveHours * 60 * tripsNeeded + state.driveHours * 60 * (tripsNeeded - 1);
  const moveDayMin = carryMin + driveMin;

  // ---- 5. Packing time ----
  let packMin = 0;
  roomBoxes.forEach((rb) => Object.keys(rb.sizes).forEach((s) => (packMin += rb.sizes[s] * BOX_SIZES[s].packMin)));
  const essentialsMin = 30;
  const totalPackMin = packMin + furniturePrepMin + essentialsMin;

  return {
    roomBoxes, raw, rawTotal, withBuffer, totalBoxes, fragileBoxes,
    supplyLines, suppliesCost,
    furnitureCount, heavyCount, furnitureCuFt, furniturePrepMin, boxCuFt,
    stuffCuFt, neededCuFt, vehicle, carOk, tripsNeeded, biggestItem,
    people, crew, moveDayMin, carryMin, driveMin,
    packMin, totalPackMin, essentialsMin,
  };
}

/* ---------- Packing timeline (works backwards from move day) ---------- */
function buildTimeline(plan) {
  const today = startOfToday();
  const move = parseISODate(state.moveDate);
  const daysLeft = daysBetween(today, move); // days you can pack: today .. day before move
  if (isNaN(daysLeft)) return { error: "Pick a move date to see your schedule." };
  if (daysLeft <= 0) return { error: "Your move date is today or already passed. Pick a future date to build a schedule." };

  // One work unit per box, least-used rooms first; furniture prep and essentials go last.
  const units = [];
  const sorted = [...plan.roomBoxes].sort((a, b) => a.type.priority - b.type.priority);
  sorted.forEach((rb) => {
    Object.keys(BOX_SIZES).forEach((s) => {
      for (let i = 0; i < rb.sizes[s]; i++) units.push({ group: rb.type.label + "#" + rb.room.id, label: rb.type.label, size: s, min: BOX_SIZES[s].packMin });
    });
  });
  Object.entries(state.furniture).forEach(([key, n]) => {
    const f = FURNITURE[key];
    if (!f || !n || !f.prepMin) return;
    for (let i = 0; i < n; i++) units.push({ group: "furn-" + key, label: (f.prepMin >= 15 ? "Take apart " : "Wrap ") + f.label.toLowerCase(), min: f.prepMin, furniture: true });
  });
  units.push({ group: "essentials", label: "Pack your night-1 bag (see New place setup)", min: plan.essentialsMin, furniture: true });

  const total = units.reduce((a, u) => a + u.min, 0);
  const capPerDay = Math.max(30, state.freeHours * 60);
  const daysNeeded = Math.ceil(total / capPerDay);

  let overflow = false;
  let perDayCap = capPerDay;
  let startOffset;
  if (daysNeeded > daysLeft) {
    overflow = true;
    perDayCap = Math.ceil(total / daysLeft);
    startOffset = 0;
  } else {
    // leave one spare day before the move as a cushion when there's room
    const cushion = daysLeft - daysNeeded >= 1 ? 1 : 0;
    startOffset = daysLeft - daysNeeded - cushion;
  }

  // Fill days in order. A unit moves to the next day if it won't fit.
  const days = [];
  let cur = null;
  units.forEach((u) => {
    if (!cur || (cur.used > 0 && cur.used + u.min > perDayCap)) {
      cur = { offset: startOffset + days.length, used: 0, units: [] };
      days.push(cur);
    }
    cur.units.push(u);
    cur.used += u.min;
  });

  const scheduleDays = days.map((d) => {
    const date = addDays(today, d.offset);
    // group the units into readable lines
    const lines = [];
    const byGroup = new Map();
    d.units.forEach((u) => {
      if (!byGroup.has(u.group)) {
        const entry = { label: u.label, furniture: !!u.furniture, sizes: {}, count: 0 };
        byGroup.set(u.group, entry);
        lines.push(entry);
      }
      const g = byGroup.get(u.group);
      g.count++;
      if (u.size) g.sizes[u.size] = (g.sizes[u.size] || 0) + 1;
    });
    return { date, daysOut: daysBetween(date, move), minutes: d.used, lines };
  });

  return {
    days: scheduleDays, total, daysNeeded, daysLeft, overflow, perDayCap,
    startDate: addDays(today, startOffset), move, startOffset,
  };
}

/* ================= RENDER ================= */

const $ = (id) => document.getElementById(id);

function renderInputs() {
  $("moveDate").value = state.moveDate;
  $("fromType").value = state.fromType;
  $("toType").value = state.toType;
  $("freeHours").value = state.freeHours;
  $("driveHours").value = state.driveHours;
  $("helpers").value = state.helpers;

  // room type picker for "Add room"
  $("newRoomType").innerHTML = Object.entries(ROOM_TYPES)
    .map(([k, t]) => `<option value="${k}">${t.label}</option>`).join("");

  renderRooms();
  renderFurniture();
}

function renderRooms() {
  const list = $("roomList");
  if (state.rooms.length === 0) {
    list.innerHTML = `<li class="hint">No rooms yet. Add one below or tap "Use typical rooms".</li>`;
    return;
  }
  list.innerHTML = state.rooms.map((r) => {
    const t = ROOM_TYPES[r.type];
    const btn = (f, text) => `<button type="button" data-room="${r.id}" data-fullness="${f}" aria-pressed="${r.fullness === f}">${text}</button>`;
    return `
      <li class="room">
        <span class="room-name">${t.label}</span>
        <button type="button" class="icon-btn" data-remove-room="${r.id}" aria-label="Remove ${t.label}">×</button>
        <div class="fullness" role="group" aria-label="${t.label} fullness">
          ${btn("light", "Light")}${btn("medium", "Medium")}${btn("packed", "Packed")}
        </div>
      </li>`;
  }).join("");
}

function renderFurniture() {
  $("furnitureList").innerHTML = Object.entries(FURNITURE).map(([k, f]) => {
    const n = state.furniture[k] || 0;
    return `
      <li class="furn">
        <span>${f.label}</span>
        <span class="stepper">
          <button type="button" data-furn="${k}" data-step="-1" aria-label="One fewer ${f.label}">−</button>
          <output aria-live="polite">${n}</output>
          <button type="button" data-furn="${k}" data-step="1" aria-label="One more ${f.label}">+</button>
        </span>
      </li>`;
  }).join("");
}

function renderManifest(plan, tl) {
  const move = parseISODate(state.moveDate);
  const daysLeft = daysBetween(startOfToday(), move);
  let alert = "";
  if (tl.overflow) {
    alert = `<div class="manifest-alert">You need about ${hrs(tl.total)} of packing but only have ${plural(tl.daysLeft, "day")} left at ${state.freeHours} hrs a day. Plan on ${hrs(tl.perDayCap)} a day, or get help packing.</div>`;
  } else if (state.helpers < plan.people) {
    alert = `<div class="manifest-alert">Move day needs about ${plan.people} people and you've got ${state.helpers}. Line up ${plural(plan.people - state.helpers, "more helper")}.</div>`;
  }
  $("manifest").innerHTML = `
    <div class="manifest-title">Your move, ${daysLeft > 0 ? plural(daysLeft, "day") + " out" : "date needs fixing"}</div>
    <div class="manifest-grid">
      <div class="stat"><span class="stat-num">${plan.totalBoxes}</span><span class="stat-label">boxes</span></div>
      <div class="stat"><span class="stat-num">${money(plan.suppliesCost)}</span><span class="stat-label">in supplies</span></div>
      <div class="stat"><span class="stat-num small">${esc(plan.vehicle.label)}</span><span class="stat-label">${plan.tripsNeeded > 1 ? plan.tripsNeeded + " trips" : "to rent or drive"}</span></div>
      <div class="stat"><span class="stat-num">${Math.round(plan.totalPackMin / 60)}</span><span class="stat-label">hours of packing</span></div>
    </div>
    ${alert}`;
}

function renderSupplies(plan) {
  if (plan.supplyLines.length === 0) {
    $("panel-supplies").innerHTML = `<h3>Supplies</h3><p class="panel-intro">Add a room or some furniture on the left and your shopping list shows up here.</p>`;
    return;
  }
  const rows = plan.supplyLines.map((l) => `
    <tr>
      <td>
        <strong>${l.label}</strong>
        ${state.showMath ? `<span class="math">${l.math}</span>` : ""}
      </td>
      <td class="num">${l.need}</td>
      <td class="num">${l.packs} × ${l.unit === 1 ? "1" : "pack of " + l.unit}</td>
      <td class="num">
        <label class="sr">
          <input class="price-input" type="number" min="0" step="1" value="${priceOf(l.key)}" data-price="${l.key}" aria-label="Price per pack for ${l.label}">
        </label>
      </td>
      <td class="num">${money(l.cost)}</td>
    </tr>`).join("");

  $("panel-supplies").innerHTML = `
    <div class="panel-head">
      <h3>Supplies</h3>
      <label class="toggle"><input type="checkbox" id="showMath" ${state.showMath ? "checked" : ""}> Show the math</label>
    </div>
    <p class="panel-intro">Rounded up to what stores actually sell. You can't buy 3.7 packs of boxes. Prices are rough guesses, so change them to match your store.</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Item</th><th class="num">Need</th><th class="num">Buy</th><th class="num">Price / pack</th><th class="num">Cost</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="4">Total</td><td class="num">${money(plan.suppliesCost)}</td></tr></tfoot>
      </table>
    </div>
    <button type="button" class="link-btn" id="copyList">Copy shopping list</button>
    <button type="button" class="link-btn" id="resetPrices" style="margin-left:16px">Reset prices</button>`;
}

function renderVehicle(plan) {
  const pct = (cap) => Math.min(100, Math.round((plan.neededCuFt / cap) * 100));
  const list = VEHICLES.map((v) => {
    const fits = v.cuFt >= plan.neededCuFt && (plan.carOk || v.cuFt > 60);
    const cls = v === plan.vehicle ? "is-pick" : fits ? "" : "too-small";
    return `<li class="${cls}">
      <span>${v.label}</span>
      <span class="fill-bar" aria-hidden="true"><span style="width:${pct(v.cuFt)}%"></span></span>
      <span>${fits ? pct(v.cuFt) + "% full" : "too small"}</span>
    </li>`;
  }).join("");

  const crewNote = state.helpers >= plan.people
    ? `<p class="callout good">You've got ${plural(state.helpers, "person")} lined up. That covers it.</p>`
    : `<p class="callout warn">You've got ${plural(state.helpers, "person")}. Aim for ${plan.people}${plan.heavyCount ? ", since heavy stuff like a couch or dresser needs two people per item" : ""}.</p>`;

  const carNote = !plan.carOk
    ? `<p class="callout">Something you're moving is too big for a car or SUV (biggest item takes about ${plan.biggestItem} cu ft), so the smallest option is a van.</p>`
    : "";

  $("panel-vehicle").innerHTML = `
    <div class="panel-head"><h3>Vehicle and help</h3></div>
    <div class="vehicle-pick">
      <span class="stat-num">${esc(plan.vehicle.label)}</span>
      <p class="vehicle-why">
        Your stuff takes about <strong>${Math.round(plan.stuffCuFt)} cu ft</strong>
        (${Math.round(plan.boxCuFt)} in boxes, ${Math.round(plan.furnitureCuFt)} in furniture).
        Things never stack perfectly, so plan for ${Math.round(plan.stuffCuFt)} × ${LOADING_SLACK} = <strong>${Math.round(plan.neededCuFt)} cu ft</strong>.
        ${plan.vehicle.rate ? ` Rental runs about ${money(plan.vehicle.rate)} a day plus mileage.` : ""}
        ${plan.tripsNeeded > 1 ? ` Even the biggest truck needs <strong>${plan.tripsNeeded} trips</strong>. Consider movers.` : ""}
      </p>
    </div>
    <ul class="vehicle-list">${list}</ul>
    ${carNote}
    <h3 style="font-size:17px;margin:20px 0 10px">Move day</h3>
    ${crewNote}
    <p class="panel-intro">
      Carrying everything out and back in is about ${hrs(plan.carryMin * plan.crew)} of work for one person.
      Split across ${plural(plan.crew, "person")} that's ${hrs(plan.carryMin)}, plus ${hrs(plan.driveMin)} of driving.
      Block off <strong>${hrs(plan.moveDayMin)}</strong> for move day.
    </p>`;
}

function describeLine(line) {
  if (line.furniture) return line.count > 1 ? `${line.label} (×${line.count})` : line.label;
  const parts = Object.keys(BOX_SIZES).filter((s) => line.sizes[s]).map((s) => `${line.sizes[s]} ${s}`);
  return `${line.label}: ${plural(line.count, "box")}${parts.length > 1 ? " (" + parts.join(", ") + ")" : ""}`;
}

function renderTimeline(plan, tl) {
  const panel = $("panel-timeline");
  if (tl.error) {
    panel.innerHTML = `<h3>Packing timeline</h3><p class="panel-intro">${tl.error}</p>`;
    return;
  }
  const today = startOfToday();
  let summary;
  if (tl.overflow) {
    summary = `<p class="callout warn">At ${state.freeHours} hrs a day you'd need ${plural(tl.daysNeeded, "day")}, but you only have ${tl.daysLeft}. This schedule starts today and packs about ${hrs(tl.perDayCap)} a day.</p>`;
  } else if (tl.startOffset === 0) {
    summary = `<p class="callout warn">Start today. You need ${plural(tl.daysNeeded, "day")} of packing at ${state.freeHours} hrs a day, which is about every day you have left.</p>`;
  } else {
    summary = `<p class="callout good">You need ${plural(tl.daysNeeded, "day")} of packing at ${state.freeHours} hrs a day. Start by <strong>${fmtDay(tl.startDate)}</strong> and you'll finish with a day to spare. Buy supplies before then.</p>`;
  }

  const items = [];
  if (tl.startOffset > 0) {
    items.push(`<li class="day is-free">
      <div class="day-date">${fmtDay(today)}<span class="day-count">today</span></div>
      <div><ul class="day-tasks"><li>Nothing to pack yet. Order supplies so they're here by ${fmtDay(tl.startDate)}.</li></ul></div>
    </li>`);
  }
  tl.days.forEach((d) => {
    items.push(`<li class="day">
      <div class="day-date">${fmtDay(d.date)}<span class="day-count">${plural(d.daysOut, "day")} out</span></div>
      <div>
        <ul class="day-tasks">${d.lines.map((l) => `<li>${esc(describeLine(l))}</li>`).join("")}</ul>
        <div class="day-hours">About ${hrs(d.minutes)}</div>
      </div>
    </li>`);
  });
  items.push(`<li class="day is-move">
    <div class="day-date">${fmtDay(tl.move)}<span class="day-count">move day</span></div>
    <div>
      <ul class="day-tasks">
        <li>Pick up the ${esc(plan.vehicle.label.toLowerCase())}${plan.vehicle.rate ? "" : " (clear it out first)"}</li>
        <li>Load heavy furniture first, then boxes, then the night-1 bag last so it comes out first</li>
        <li>Photograph the empty place before you hand back keys</li>
      </ul>
      <div class="day-hours">About ${hrs(plan.moveDayMin)} with ${plural(plan.crew, "person")}</div>
    </div>
  </li>`);

  panel.innerHTML = `
    <div class="panel-head"><h3>Packing timeline</h3></div>
    <p class="panel-intro">Works backwards from move day. Rooms you use least get packed first. Kitchen and bathroom go last.</p>
    ${summary}
    <ol class="days">${items.join("")}</ol>`;
}

function setupEntry(id) {
  return state.setup[id] || { have: false, who: "split" };
}

function renderSetup() {
  const toDorm = state.toType === "dorm";
  const people = ["me", ...state.roommates];
  const n = people.length;
  const totals = {};
  people.forEach((p) => (totals[p] = 0));

  const tiers = Object.entries(SETUP_ITEMS).map(([tierKey, tier]) => {
    const rows = tier.items.filter((it) => !(toDorm && it.notDorm)).map((it) => {
      const e = setupEntry(it.id);
      let whoControl = "";
      if (it.scope === "each") {
        whoControl = `<span class="item-scope">${n > 1 ? "each person" : "you"}</span>`;
        if (!e.have) people.forEach((p) => (totals[p] += it.price));
      } else {
        if (n > 1) {
          const opts = [["split", "Split evenly"], ...people.map((p) => [p, p === "me" ? "Me" : p])];
          const who = people.includes(e.who) || e.who === "split" ? e.who : "split";
          whoControl = `<select data-who="${it.id}" aria-label="Who buys ${esc(it.label)}">
            ${opts.map(([v, t]) => `<option value="${esc(v)}" ${v === who ? "selected" : ""}>${esc(t)}</option>`).join("")}
          </select>`;
          if (!e.have) {
            if (who === "split") people.forEach((p) => (totals[p] += it.price / n));
            else totals[who] += it.price;
          }
        } else {
          whoControl = `<span class="item-scope">you</span>`;
          if (!e.have) totals.me += it.price;
        }
      }
      return `<div class="item-row ${e.have ? "is-have" : ""}">
        <input type="checkbox" data-have="${it.id}" ${e.have ? "checked" : ""} aria-label="Already have ${esc(it.label)}">
        <span class="item-name">${esc(it.label)}</span>
        ${whoControl}
        <span class="item-price">${money(it.price)}</span>
      </div>`;
    }).join("");
    return `<div class="tier"><h4>${tier.label}</h4><p class="tier-note">${tier.note}</p>${rows}</div>`;
  }).join("");

  const cards = people.map((p) => `<div class="split-card"><span>${p === "me" ? "You" : esc(p)}</span><strong>${money(totals[p])}</strong></div>`).join("");

  $("panel-setup").innerHTML = `
    <div class="panel-head"><h3>New place setup</h3></div>
    <p class="panel-intro">What to have ready once you're in${toDorm ? " (kitchen and apartment-only items are hidden for dorms)" : ""}. Check off what you already own and it drops out of the totals.</p>
    <div class="roommates">
      <label class="field">
        <span>Roommates (names, separated by commas)</span>
        <input type="text" id="roommatesInput" placeholder="Leave blank if it's just you" value="${esc(state.roommates.join(", "))}">
      </label>
    </div>
    ${tiers}
    <h4 style="margin:0 0 4px">Who's paying what</h4>
    <div class="split-totals">${cards}</div>`;
}

function renderTabs() {
  document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === state.tab)));
  ["supplies", "vehicle", "timeline", "setup"].forEach((k) => ($("panel-" + k).hidden = k !== state.tab));
}

function renderOutputs() {
  const plan = computePlan();
  const tl = buildTimeline(plan);
  renderManifest(plan, tl);
  renderSupplies(plan);
  renderVehicle(plan);
  renderTimeline(plan, tl);
  renderTabs();
  saveState();
  return plan;
}

/* ================= EVENTS ================= */

function numberFrom(el, fallback, min, max) {
  const v = parseFloat(el.value);
  if (isNaN(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function bindEvents() {
  $("moveDate").addEventListener("change", (e) => { state.moveDate = e.target.value; renderOutputs(); });
  $("fromType").addEventListener("change", (e) => { state.fromType = e.target.value; renderOutputs(); });
  $("toType").addEventListener("change", (e) => { state.toType = e.target.value; renderSetup(); saveState(); });
  $("freeHours").addEventListener("input", (e) => { state.freeHours = numberFrom(e.target, 2, 0.5, 16); renderOutputs(); });
  $("driveHours").addEventListener("input", (e) => { state.driveHours = numberFrom(e.target, 0, 0, 48); renderOutputs(); });
  $("helpers").addEventListener("input", (e) => { state.helpers = Math.round(numberFrom(e.target, 1, 1, 12)); renderOutputs(); });

  $("resetRooms").addEventListener("click", () => {
    state.rooms = makeTypicalRooms(state.fromType);
    renderRooms();
    renderOutputs();
  });

  $("addRoom").addEventListener("click", () => {
    state.rooms.push({ id: nextRoomId++, type: $("newRoomType").value, fullness: "medium" });
    renderRooms();
    renderOutputs();
  });

  $("roomList").addEventListener("click", (e) => {
    const rm = e.target.closest("[data-remove-room]");
    if (rm) {
      state.rooms = state.rooms.filter((r) => r.id !== Number(rm.dataset.removeRoom));
      renderRooms();
      renderOutputs();
      return;
    }
    const f = e.target.closest("[data-fullness]");
    if (f) {
      const room = state.rooms.find((r) => r.id === Number(f.dataset.room));
      if (room) room.fullness = f.dataset.fullness;
      renderRooms();
      renderOutputs();
    }
  });

  $("furnitureList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-furn]");
    if (!b) return;
    const k = b.dataset.furn;
    state.furniture[k] = Math.max(0, Math.min(20, (state.furniture[k] || 0) + Number(b.dataset.step)));
    renderFurniture();
    renderOutputs();
  });

  document.querySelector(".tabs").addEventListener("click", (e) => {
    const t = e.target.closest(".tab");
    if (!t) return;
    state.tab = t.dataset.tab;
    renderTabs();
    saveState();
  });

  // Supplies tab (re-rendered, so use delegation on the panel)
  const sup = $("panel-supplies");
  sup.addEventListener("change", (e) => {
    if (e.target.id === "showMath") { state.showMath = e.target.checked; renderOutputs(); }
    if (e.target.dataset.price) {
      const v = parseFloat(e.target.value);
      if (!isNaN(v) && v >= 0) state.prices[e.target.dataset.price] = v;
      renderOutputs();
    }
  });
  sup.addEventListener("click", (e) => {
    if (e.target.id === "resetPrices") { state.prices = {}; renderOutputs(); }
    if (e.target.id === "copyList") {
      const plan = computePlan();
      const text = "Haul shopping list\n" + plan.supplyLines.map((l) => `- ${l.label}: ${l.packs} × ${l.unit === 1 ? "1" : "pack of " + l.unit} (${money(l.cost)})`).join("\n") + `\nTotal: ${money(plan.suppliesCost)}`;
      const done = () => { e.target.textContent = "Copied"; setTimeout(() => (e.target.textContent = "Copy shopping list"), 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => window.prompt("Copy this:", text));
      else window.prompt("Copy this:", text);
    }
  });

  // Setup tab
  const setup = $("panel-setup");
  setup.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.have) {
      state.setup[t.dataset.have] = { ...setupEntry(t.dataset.have), have: t.checked };
      renderSetup(); saveState();
    } else if (t.dataset.who) {
      state.setup[t.dataset.who] = { ...setupEntry(t.dataset.who), who: t.value };
      renderSetup(); saveState();
    } else if (t.id === "roommatesInput") {
      state.roommates = t.value.split(",").map((s) => s.trim()).filter((s) => s && s.toLowerCase() !== "me").slice(0, 8);
      renderSetup(); saveState();
    }
  });

  $("printBtn").addEventListener("click", () => window.print());
}

/* ================= START ================= */
renderInputs();
bindEvents();
renderOutputs();
renderSetup();
