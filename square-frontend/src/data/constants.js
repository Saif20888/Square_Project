import { Cpu, AlertTriangle, WifiOff, Printer, HelpCircle, Laptop, Smartphone, Monitor, Package } from "lucide-react";

// Talks to the Spring Boot API here. The URL comes from the build environment
// (VITE_API_BASE in .env / the deploy config) so a production build points at
// the real backend; the fallback is local development only.
export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

// Demo fallback (seed data when the API is unreachable) is a DEVELOPMENT aid.
// In a production build it stays off, so a backend outage surfaces as a real
// error instead of silently showing fake data that looks live.
export const DEMO_FALLBACK_ENABLED =
  import.meta.env.VITE_ENABLE_DEMO === "true" || import.meta.env.DEV;

// Password for the offline demo accounts. Not written in source: set
// VITE_DEMO_PASSWORD in a local .env file (gitignored) to sign in while the
// backend is unreachable. Empty in production builds, where the demo fallback
// is switched off anyway.
const DEMO_PASSWORD = import.meta.env.DEV ? (import.meta.env.VITE_DEMO_PASSWORD || "") : "";
const PW_EMPLOYEE = DEMO_PASSWORD;
const PW_SUPERVISOR = DEMO_PASSWORD;
const PW_TECH = DEMO_PASSWORD;
const PW_ADMIN = DEMO_PASSWORD;

// Everyone is an employee; under that sit Users (many), the IT Team (many),
// one Superuser and one System admin.
export const ROLE_LABEL = { EMPLOYEE: "User", SUPERVISOR: "Superuser", IT_TECH: "IT Team", SYSTEM_ADMIN: "System admin" };

// The only designations that exist at SQUARE — used everywhere a designation is set or filtered
export const DESIGNATIONS = [
  "Executive Director", "Director", "General Manager (GM)", "Deputy General Manager (DGM)",
  "Assistant General Manager (AGM)", "Senior Manager", "Manager", "Deputy Manager",
  "Assistant Manager", "Senior Executive", "Executive", "Officer", "Assistant Officer", "Office Assistant",
];

// Company leadership shown in the view-only "Top essentials" section
export const TOP_DESIGNATIONS = ["Executive Director", "Director"];

// Every department MUST have each of these exactly once (error when adding a second)...
export const UNIQUE_DESIGNATIONS = [
  "General Manager (GM)", "Deputy General Manager (DGM)", "Assistant General Manager (AGM)",
  "Senior Manager", "Manager", "Deputy Manager", "Assistant Manager",
];
// ...and at least one of each of these (more allowed)
export const COMMON_DESIGNATIONS = ["Senior Executive", "Executive", "Officer", "Assistant Officer", "Office Assistant"];

// "HR and Admin" is an umbrella department made of three units
export const HR_ADMIN_DEPT = "HR and Admin";
export const HR_ADMIN_UNITS = ["HR", "Admin", "IT"];

export const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();
export const dateDaysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

// --- New ticket intake: locations, cascading floors, departments, problem types ---
export const LOCATIONS = ["Anita Center (HQ)", "Sector 3 Office", "CSQ", "Bay Tower"];
export const DEPARTMENTS = [
  "HR and Admin", "Commercial", "Marketing and Merchandising",
  "Accounts and Finance", "Design and Product Development", "Central Procurement and Supply Chain",
];
export const PROBLEM_TYPES = ["Hardware Malfunction", "Software Crash", "Network/Wi-Fi Outage", "Printer Error", "Other"];
export const PROBLEM_ICON = {
  "Hardware Malfunction": Cpu, "Software Crash": AlertTriangle, "Network/Wi-Fi Outage": WifiOff,
  "Printer Error": Printer, "Other": HelpCircle,
};
// --- Dynamic organization (managed by the Superuser; these are the first-boot defaults) ---
export const DEFAULT_LOCATIONS = [
  { id: 1, name: "Anita Center (HQ)", floors: 11 },
  { id: 2, name: "Sector 3 Office", floors: 6 },
  { id: 3, name: "CSQ", floors: 6 },
  { id: 4, name: "Bay Tower", floors: 6 },
];
export const DEFAULT_DEPARTMENTS = DEPARTMENTS.map((name, i) => ({ id: i + 1, name }));

// Floor options for a location, driven by the Superuser-managed office list
export function floorsFor(locationName, locations) {
  const loc = (locations || []).find((l) => l.name === locationName);
  const max = loc?.floors || (locationName === "Anita Center (HQ)" ? 11 : 6);
  return Array.from({ length: max }, (_, i) => i + 1);
}

// --- Employee device registration: kinds, asset categories ---
export const DEVICE_KINDS = ["Mobile", "Laptop", "Desktop", "Printer", "Other"];
export const ASSET_CATEGORIES = ["Asset", "Non-Asset"];

// One definite icon per device kind
export const DEVICE_KIND_ICON = { Mobile: Smartphone, Laptop: Laptop, Desktop: Monitor, Printer: Printer, Other: Package };

// Resolves an asset's kind — uses the registered deviceKind, falling back to
// guessing from the device name for older/seeded assets.
export function deviceKindOf(asset) {
  if (asset.deviceKind && DEVICE_KINDS.includes(asset.deviceKind)) return asset.deviceKind;
  const t = (asset.deviceType || "").toLowerCase();
  if (t.includes("laptop")) return "Laptop";
  if (t.includes("mobile") || t.includes("phone")) return "Mobile";
  if (t.includes("desktop") || t.includes("workstation") || t.includes("monitor")) return "Desktop";
  if (t.includes("printer")) return "Printer";
  return "Other";
}
export const deviceIconFor = (asset) => DEVICE_KIND_ICON[deviceKindOf(asset)];

// --- Where IT stores devices received back from offboarded employees ---
export const STORAGE_LOCATIONS = ["IT Closet", "Basement", "Sector 3"];

// A ticket that sits OPEN this many days triggers a supervisor alert.
export const PENDING_ALERT_DAYS = 3;

/* ----------------------------------- Seed data (mirrors the backend seed) -------- */
// Deterministic demo phone number derived from the username (same idea as the backend seed)
const phoneFor = (username) => {
  let h = 0;
  for (const c of username) h = (h * 31 + c.charCodeAt(0)) % 100000000;
  return "+88017" + String(10000000 + (h % 90000000)).slice(0, 8);
};
const U = (id, username, password, role, name, jobTitle, managerUsername, daysWorking, department) => ({
  id, username, password, role, name, jobTitle, managerUsername, department,
  // HR and Admin members belong to one of its units: IT staff to IT, the rest split HR/Admin
  unit: department === "HR and Admin"
    ? (role === "IT_TECH" || role === "SYSTEM_ADMIN" ? "IT" : id % 2 === 0 ? "HR" : "Admin")
    : null,
  employeeId: `SQ-EMP-${String(id).padStart(4, "0")}`, offboarded: false,
  email: `${username}@squaregroup.com`, phone: phoneFor(username), joinedAt: dateDaysAgo(daysWorking),
});

// Generated demo employees — same lists as the backend seed, so live and demo look alike
const GEN_FIRST = ["Rafiq", "Hasan", "Jannat", "Shakib", "Farzana", "Imran", "Sadia", "Rubel", "Tania", "Mahmud", "Rina", "Sohel", "Nabila", "Asif", "Sharmin", "Zahid", "Lamia", "Tarek", "Shorna", "Fahim"];
const GEN_LAST = ["Islam", "Hossain", "Rahman", "Akter", "Chowdhury", "Ahmed", "Karim", "Begum", "Uddin", "Khan"];
const GEN_TITLES = ["Executive", "Officer", "Senior Executive", "Assistant Officer", "Deputy Manager", "Assistant Manager", "Office Assistant", "Executive", "Officer", "Senior Executive"];

// Fillers so every department holds its full designation ladder — each unique
// designation exactly once, each common one at least once (mirrors the backend seed).
const FILL_FIRST = [
  "Arman", "Bashir", "Chandan", "Dilara", "Eshita", "Feroz", "Habib", "Ishrat", "Jubayer",
  "Kanta", "Liton", "Monir", "Nayeem", "Omar", "Parvez", "Rukhsana", "Salma", "Tuhin",
  "Wasim", "Yasmin", "Zubaida", "Anika", "Belal", "Chumki", "Delwar", "Elias", "Farid",
  "Galib", "Hafsa", "Iqbal", "Jesmin", "Kabir", "Lubna", "Mamun", "Nishat", "Oli",
  "Pial", "Rasel", "Shefali", "Tamim", "Urmi", "Waliul", "Yusuf", "Zakia", "Bristy",
];
const FILL_MISSING = {
  "HR and Admin": ["General Manager (GM)", "Deputy General Manager (DGM)", "Assistant General Manager (AGM)", "Deputy Manager", "Assistant Manager"],
  "Commercial": ["General Manager (GM)", "Deputy General Manager (DGM)", "Assistant General Manager (AGM)", "Manager", "Deputy Manager", "Assistant Manager", "Office Assistant"],
  "Marketing and Merchandising": ["General Manager (GM)", "Deputy General Manager (DGM)", "Assistant General Manager (AGM)", "Senior Manager", "Manager", "Assistant Manager", "Executive", "Assistant Officer", "Office Assistant"],
  "Accounts and Finance": ["General Manager (GM)", "Deputy General Manager (DGM)", "Assistant General Manager (AGM)", "Senior Manager", "Manager", "Deputy Manager", "Officer", "Office Assistant"],
  "Design and Product Development": ["General Manager (GM)", "Deputy General Manager (DGM)", "Assistant General Manager (AGM)", "Senior Manager", "Manager", "Assistant Manager", "Officer", "Assistant Officer"],
  "Central Procurement and Supply Chain": ["General Manager (GM)", "Deputy General Manager (DGM)", "Assistant General Manager (AGM)", "Senior Manager", "Deputy Manager", "Senior Executive", "Assistant Officer", "Office Assistant"],
};
let _fid = 0;
const FILL_USERS = DEPARTMENTS.flatMap((dept) => FILL_MISSING[dept].map((desig) => {
  const i = _fid++;
  const first = FILL_FIRST[i];
  return U(38 + i, first.toLowerCase(), PW_EMPLOYEE, "EMPLOYEE",
    `${first} ${GEN_LAST[i % GEN_LAST.length]}`, desig, "manager1", 200 + i * 61, dept);
}));

export const SEED_USERS = [
  U(1, "saif", PW_EMPLOYEE, "EMPLOYEE", "Md Saif Shahriar", "Senior Executive", "manager1", 900, "Design and Product Development"),
  U(2, "raihan", PW_EMPLOYEE, "EMPLOYEE", "Raihan Kabir", "Executive", "manager1", 1500, "Commercial"),
  U(3, "nusrat", PW_EMPLOYEE, "EMPLOYEE", "Nusrat Jahan", "Officer", "manager1", 420, "Marketing and Merchandising"),
  U(4, "manager1", PW_SUPERVISOR, "SUPERVISOR", "Rumana Karim", "Manager", null, 3200, "HR and Admin"),
  U(5, "tech1", PW_TECH, "IT_TECH", "Arif Chowdhury", "Executive", null, 2100, "HR and Admin"),
  U(6, "admin1", PW_ADMIN, "SYSTEM_ADMIN", "Nadia Rahman", "Senior Manager", null, 2800, "HR and Admin"),
  U(7, "tanvir", PW_EMPLOYEE, "EMPLOYEE", "Tanvir Ahmed", "Executive", "manager1", 1100, "Accounts and Finance"),
  U(8, "sabrina", PW_EMPLOYEE, "EMPLOYEE", "Sabrina Islam", "Senior Executive", "manager1", 700, "Design and Product Development"),
  U(9, "kamal", PW_EMPLOYEE, "EMPLOYEE", "Kamal Hossain", "Manager", "manager1", 1900, "Central Procurement and Supply Chain"),
  // Rumana Karim (manager1) is the one and only Superuser; Priya is a regular User now
  U(10, "priya", PW_EMPLOYEE, "EMPLOYEE", "Priya Chakraborty", "Senior Manager", "manager1", 2600, "Commercial"),
  U(11, "farhan", PW_EMPLOYEE, "EMPLOYEE", "Farhan Islam", "Officer", "manager1", 500, "HR and Admin"),
  U(12, "mitu", PW_EMPLOYEE, "EMPLOYEE", "Mitu Akter", "Executive", "manager1", 1300, "Commercial"),
  U(13, "tech2", PW_TECH, "IT_TECH", "Sabbir Ahmed", "Officer", null, 1700, "HR and Admin"),
  U(14, "tech3", PW_TECH, "IT_TECH", "Mehedi Hasan", "Assistant Officer", null, 1200, "HR and Admin"),
  U(15, "tech4", PW_TECH, "IT_TECH", "Shanta Akter", "Officer", null, 800, "HR and Admin"),
  // Company leadership — shown view-only under "Top essentials"
  U(16, "anisur", PW_EMPLOYEE, "EMPLOYEE", "Anisur Rahman", "Executive Director", null, 4200, "HR and Admin"),
  U(17, "tapan", PW_EMPLOYEE, "EMPLOYEE", "Tapan Chowdhury", "Director", null, 3600, "Commercial"),
  ...GEN_FIRST.map((first, i) =>
    U(18 + i, first.toLowerCase(), PW_EMPLOYEE, "EMPLOYEE",
      `${first} ${GEN_LAST[i % GEN_LAST.length]}`, GEN_TITLES[i % GEN_TITLES.length],
      "manager1", 250 + i * 137, DEPARTMENTS[i % DEPARTMENTS.length])),
  ...FILL_USERS,
];

const T = (id, raisedByUsername, location, floor, department, problemType, description, status, acceptedBy, createdDaysAgo, resolvedDaysAgo, assetId = null) => ({
  id, raisedByUsername, location, floor, department, problemType,
  description: description || problemType, status, acceptedBy, assetId,
  createdAt: daysAgo(createdDaysAgo), resolvedAt: resolvedDaysAgo == null ? null : daysAgo(resolvedDaysAgo),
});

export const SEED_TICKETS = [
  T(1, "saif", "Anita Center (HQ)", 4, "Design and Product Development", "Hardware Malfunction", null, "OPEN", null, 2, null, 1),
  T(2, "raihan", "Anita Center (HQ)", 7, "Commercial", "Network/Wi-Fi Outage", null, "OPEN", null, 1, null),
  T(3, "nusrat", "Sector 3 Office", 2, "Marketing and Merchandising", "Other", "Monitor flickers intermittently when the AC kicks in", "OPEN", null, 3, null),
  T(4, "nusrat", "Sector 3 Office", 6, "Marketing and Merchandising", "Hardware Malfunction", null, "OPEN", null, 0, null, 3),
  T(5, "tanvir", "Anita Center (HQ)", 9, "Accounts and Finance", "Software Crash", null, "SOLVING", "Arif Chowdhury", 4, null),
  T(6, "sabrina", "CSQ", 3, "Design and Product Development", "Printer Error", null, "SOLVING", "Arif Chowdhury", 2, null),
  T(7, "kamal", "Bay Tower", 5, "Central Procurement and Supply Chain", "Hardware Malfunction", null, "SOLVING", "Sabbir Ahmed", 3, null, 12),
  T(8, "tanvir", "CSQ", 6, "Accounts and Finance", "Other", "Docking station won't charge the laptop past 20%", "SOLVING", "Sabbir Ahmed", 3, null),
  T(9, "farhan", "Sector 3 Office", 1, "HR and Admin", "Network/Wi-Fi Outage", null, "CLOSED", "Sabbir Ahmed", 5, 2),
  T(10, "mitu", "Anita Center (HQ)", 2, "Commercial", "Software Crash", null, "CLOSED", "Arif Chowdhury", 14, 10),
  T(11, "saif", "Anita Center (HQ)", 4, "Design and Product Development", "Other", "Laptop fan makes a grinding noise under load", "CLOSED", "Arif Chowdhury", 23, 20),
  T(12, "priya", "Anita Center (HQ)", 11, "HR and Admin", "Printer Error", null, "REJECTED", null, 7, 6),
  // Generated history spread across the generated employees (mirrors the backend seed)
  ...Array.from({ length: 28 }, (_, i) => {
    const raiser = GEN_FIRST[i % GEN_FIRST.length].toLowerCase();
    const location = LOCATIONS[i % LOCATIONS.length];
    const floor = (i % (location === "Anita Center (HQ)" ? 11 : 6)) + 1;
    const dept = DEPARTMENTS[i % DEPARTMENTS.length];
    const problem = PROBLEM_TYPES[i % PROBLEM_TYPES.length];
    const desc = problem === "Other" ? "Peripheral acting up — needs a technician visit" : null;
    const status = i % 7 === 0 ? "OPEN" : i % 7 === 1 ? "SOLVING" : i % 7 === 2 ? "REJECTED" : "CLOSED";
    const acceptedBy = status === "OPEN" || status === "REJECTED" ? null : (i % 2 === 0 ? "Arif Chowdhury" : "Sabbir Ahmed");
    const created = 3 + i * 3;
    const resolved = status === "CLOSED" || status === "REJECTED" ? Math.max(0, created - 2) : null;
    return T(13 + i, raiser, location, floor, dept, problem, desc, status, acceptedBy, created, resolved);
  }),
];

let _aid = 0;
// Seed assets are authored as a fixed "days remaining" for readability, but that
// number would otherwise freeze the moment the module loads — unlike the live
// backend, which recomputes warranty from the purchase/expiry date on every
// request. Store the absolute expiry instead so demo mode can recompute the
// same way (see withFreshWarranty), keeping the countdown accurate across days.
const A = (over) => {
  const days = over.warrantyDaysRemaining ?? 0;
  return {
    id: ++_aid, serialNumber: "", deviceType: "", deviceKind: null, specifications: "", status: "ALLOCATED_IN_USE",
    warrantyDaysRemaining: days, warrantyExpiry: dateDaysAgo(-days), userId: null, purchaseDate: null, originalValue: 0, usefulLifeYears: 4,
    poolCondition: null, isLoaner: false, loanerIssuedAt: null, repairShop: null, sentToRepairAt: null,
    pendingUserId: null, prNumber: null, assetCategory: null, assetNumber: null, supplierName: null,
    department: null, storageLocation: null, scrapReason: null, scrappedAt: null, ...over,
  };
};

// Recomputes warrantyDaysRemaining from the stored absolute expiry so demo-mode
// assets count down in real time instead of showing a stale value from whenever
// the seed/asset was created. Assets without an expiry (older persisted demo
// stores, or live data) pass through unchanged.
export function withFreshWarranty(asset) {
  if (!asset.warrantyExpiry) return asset;
  const warrantyDaysRemaining = Math.round((new Date(asset.warrantyExpiry).getTime() - Date.now()) / 86400000);
  return { ...asset, warrantyDaysRemaining };
}

const GEN_TYPES = ["Model X Laptop", "Standard Desktop", "SQUARE Mobile Unit"];
const GEN_SPECS = ["Core i7 · 16GB RAM · 512GB NVMe", "Ryzen 5 · 16GB RAM · 512GB SSD", "5G · 256GB storage"];
const GEN_VALUES = [1400, 950, 760];

export const SEED_ASSETS = [
  // Assigned to employees
  A({ serialNumber: "SQ-89304-DL", deviceType: "Model X Laptop", specifications: "Core i9 · 32GB RAM · 1TB NVMe", warrantyDaysRemaining: 450, userId: 1, purchaseDate: dateDaysAgo(280), originalValue: 1400 }),
  A({ serialNumber: "SQ-50219-MB", deviceType: "SQUARE Mobile Unit", specifications: "5G · 256GB storage", warrantyDaysRemaining: -30, userId: 1, purchaseDate: dateDaysAgo(760), originalValue: 760, usefulLifeYears: 3 }),
  A({ serialNumber: "SQ-40077-DL", deviceType: "Model X Laptop", specifications: "Core i7 · 16GB RAM · 512GB NVMe", warrantyDaysRemaining: 600, userId: 3, purchaseDate: dateDaysAgo(100), originalValue: 1400 }),
  // Loaner currently deployed — feeds the Live Loaner Ledger
  A({ serialNumber: "SQ-91234-DL", deviceType: "Model X Laptop", specifications: "Core i5 · 16GB RAM · 512GB NVMe", warrantyDaysRemaining: -50, userId: 2, purchaseDate: dateDaysAgo(900), originalValue: 1200, isLoaner: true, loanerIssuedAt: dateDaysAgo(6) }),
  // Inventory (NEW) + loaner-pool (REPAIRED / OLD_FUNCTIONAL) stock
  A({ serialNumber: "SQ-77120-DL", deviceType: "Model X Laptop", specifications: "Core i7 · 16GB RAM · 512GB NVMe", status: "AVAILABLE_IN_POOL", warrantyDaysRemaining: 700, purchaseDate: dateDaysAgo(60), originalValue: 1350, poolCondition: "NEW" }),
  A({ serialNumber: "SQ-61044-DL", deviceType: "Model X Laptop", specifications: "Core i5 · 16GB RAM · 256GB NVMe (repaired unit)", status: "AVAILABLE_IN_POOL", warrantyDaysRemaining: 200, purchaseDate: dateDaysAgo(400), originalValue: 1100, poolCondition: "REPAIRED" }),
  A({ serialNumber: "SQ-30022-WS", deviceType: "Legacy Workstation", specifications: "Core i5 · 8GB RAM · 256GB SSD", status: "AVAILABLE_IN_POOL", warrantyDaysRemaining: -100, purchaseDate: dateDaysAgo(900), originalValue: 900, usefulLifeYears: 5, poolCondition: "OLD_FUNCTIONAL" }),
  // Scrapped — feeds the Scrap Registry
  A({ serialNumber: "SQ-10099-DL", deviceType: "Model X Laptop", specifications: "Core i9 · 32GB RAM · 1TB NVMe", status: "SCRAPPED", warrantyDaysRemaining: -200, purchaseDate: dateDaysAgo(1000), originalValue: 1400, scrapReason: "Battery swelling — safety hazard, decommissioned per IT policy", scrappedAt: dateDaysAgo(15) }),
  A({ serialNumber: "SQ-20087-SVR", deviceType: "Data Server Stack", specifications: "Dual Xeon · 128GB RAM · 8x NVMe RAID", status: "SCRAPPED", warrantyDaysRemaining: -300, purchaseDate: dateDaysAgo(1200), originalValue: 8500, usefulLifeYears: 6, scrapReason: "Motherboard fire damage during PSU failure", scrappedAt: dateDaysAgo(40) }),
  // More assigned devices — wider team, wider device-type mix
  A({ serialNumber: "SQ-64521-DL", deviceType: "Model X Laptop", specifications: "Core i7 · 16GB RAM · 512GB NVMe", warrantyDaysRemaining: 580, userId: 7, purchaseDate: dateDaysAgo(150), originalValue: 1400 }),
  A({ serialNumber: "SQ-73390-DL", deviceType: "Model X Laptop", specifications: "Core i7 · 16GB RAM · 1TB NVMe", warrantyDaysRemaining: 690, userId: 8, purchaseDate: dateDaysAgo(45), originalValue: 1450 }),
  A({ serialNumber: "SQ-88213-MB", deviceType: "SQUARE Mobile Unit", specifications: "5G · 256GB storage", warrantyDaysRemaining: 15, userId: 9, purchaseDate: dateDaysAgo(700), originalValue: 760, usefulLifeYears: 3 }),
  A({ serialNumber: "SQ-99012-DT", deviceType: "Standard Desktop", specifications: "Ryzen 7 · 32GB RAM · 1TB SSD", warrantyDaysRemaining: 520, userId: 11, purchaseDate: dateDaysAgo(200), originalValue: 1100, usefulLifeYears: 5 }),
  A({ serialNumber: "SQ-45678-DL", deviceType: "Model X Laptop", specifications: "Core i5 · 16GB RAM · 256GB NVMe", warrantyDaysRemaining: -60, userId: 12, purchaseDate: dateDaysAgo(820), originalValue: 1350 }),
  A({ serialNumber: "SQ-33109-DT", deviceType: "Standard Desktop", specifications: "Ryzen 5 · 16GB RAM · 512GB SSD", warrantyDaysRemaining: 430, userId: 10, purchaseDate: dateDaysAgo(300), originalValue: 950, usefulLifeYears: 5 }),
  // More pool stock across all three conditions
  A({ serialNumber: "SQ-15044-DL", deviceType: "Model X Laptop", specifications: "Core i7 · 16GB RAM · 512GB NVMe", status: "AVAILABLE_IN_POOL", warrantyDaysRemaining: 740, purchaseDate: dateDaysAgo(20), originalValue: 1400, poolCondition: "NEW" }),
  A({ serialNumber: "SQ-15288-DL", deviceType: "Model X Laptop", specifications: "Core i7 · 16GB RAM · 512GB NVMe", status: "AVAILABLE_IN_POOL", warrantyDaysRemaining: 750, purchaseDate: dateDaysAgo(10), originalValue: 1400, poolCondition: "NEW" }),
  A({ serialNumber: "SQ-52290-MB", deviceType: "SQUARE Mobile Unit", specifications: "5G · 256GB storage (repaired unit)", status: "AVAILABLE_IN_POOL", warrantyDaysRemaining: 80, purchaseDate: dateDaysAgo(500), originalValue: 700, usefulLifeYears: 3, poolCondition: "REPAIRED" }),
  A({ serialNumber: "SQ-60871-DT", deviceType: "Standard Desktop", specifications: "Ryzen 5 · 16GB RAM · 256GB SSD", status: "AVAILABLE_IN_POOL", warrantyDaysRemaining: -200, purchaseDate: dateDaysAgo(1100), originalValue: 800, usefulLifeYears: 5, poolCondition: "OLD_FUNCTIONAL" }),
  // Second loaner currently deployed
  A({ serialNumber: "SQ-70044-DL", deviceType: "Model X Laptop", specifications: "Core i5 · 8GB RAM · 256GB NVMe", warrantyDaysRemaining: -80, userId: 8, purchaseDate: dateDaysAgo(1000), originalValue: 1100, isLoaner: true, loanerIssuedAt: dateDaysAgo(3) }),
  // Devices currently out for repair — feeds the tech Repair log
  A({ serialNumber: "SQ-27561-DL", deviceType: "Model X Laptop", specifications: "Core i7 · 16GB RAM · 512GB NVMe", status: "IN_REPAIR", warrantyDaysRemaining: 500, userId: 2, purchaseDate: dateDaysAgo(200), originalValue: 1400, repairShop: "Original shop (warranty)", sentToRepairAt: dateDaysAgo(4) }),
  A({ serialNumber: "SQ-38217-MB", deviceType: "SQUARE Mobile Unit", specifications: "5G · 128GB storage", status: "IN_REPAIR", warrantyDaysRemaining: -70, userId: 8, purchaseDate: dateDaysAgo(800), originalValue: 720, usefulLifeYears: 3, repairShop: "Trusted repair shop", sentToRepairAt: dateDaysAgo(9) }),
  // More scrap history
  A({ serialNumber: "SQ-19022-MB", deviceType: "SQUARE Mobile Unit", specifications: "5G · 256GB storage", status: "SCRAPPED", warrantyDaysRemaining: -400, purchaseDate: dateDaysAgo(1300), originalValue: 760, usefulLifeYears: 3, scrapReason: "Water damage — internal corrosion, beyond repair", scrappedAt: dateDaysAgo(25) }),
  A({ serialNumber: "SQ-84410-DT", deviceType: "Standard Desktop", specifications: "Ryzen 5 · 16GB RAM · 512GB SSD", status: "SCRAPPED", warrantyDaysRemaining: -600, purchaseDate: dateDaysAgo(1500), originalValue: 1000, usefulLifeYears: 5, scrapReason: "PSU failure caused board damage", scrappedAt: dateDaysAgo(60) }),
  // One device per generated employee
  ...GEN_FIRST.map((_, i) => {
    const type = i % GEN_TYPES.length;
    const ageDays = 60 + i * 90;
    return A({
      serialNumber: `SQ-${String(40000 + i * 137).padStart(5, "0")}-GN`,
      deviceType: GEN_TYPES[type], specifications: GEN_SPECS[type],
      warrantyDaysRemaining: 730 - ageDays, userId: 18 + i, purchaseDate: dateDaysAgo(ageDays),
      originalValue: GEN_VALUES[type], usefulLifeYears: type === 2 ? 3 : 4,
    });
  }),
  // Extra inventory (NEW) + loaner-pool stock
  ...Array.from({ length: 6 }, (_, i) => {
    const cond = i < 3 ? "NEW" : i < 5 ? "REPAIRED" : "OLD_FUNCTIONAL";
    const type = i % GEN_TYPES.length;
    return A({
      serialNumber: `SQ-${String(50000 + i * 211).padStart(5, "0")}-PL`,
      deviceType: GEN_TYPES[type], specifications: GEN_SPECS[type],
      status: "AVAILABLE_IN_POOL", poolCondition: cond,
      warrantyDaysRemaining: cond === "NEW" ? 720 : 60,
      purchaseDate: dateDaysAgo(cond === "NEW" ? 15 + i * 5 : 500 + i * 60),
      originalValue: GEN_VALUES[type],
    });
  }),
  // Nobody works without a device — Superuser, IT Team, admin and leadership included
  ...[4, 5, 6, 13, 14, 15, 16, 17].map((uid, i) => {
    const type = i % GEN_TYPES.length;
    return A({
      serialNumber: `SQ-${String(60000 + i * 173).padStart(5, "0")}-ST`,
      deviceType: GEN_TYPES[type], specifications: GEN_SPECS[type],
      warrantyDaysRemaining: 500 - i * 30, userId: uid, purchaseDate: dateDaysAgo(230 + i * 40),
      originalValue: GEN_VALUES[type], usefulLifeYears: type === 2 ? 3 : 4,
    });
  }),
  // ...and one device for each department-ladder filler employee
  ...FILL_USERS.map((u, i) => {
    const type = i % GEN_TYPES.length;
    return A({
      serialNumber: `SQ-${String(70000 + i * 131).padStart(5, "0")}-FL`,
      deviceType: GEN_TYPES[type], specifications: GEN_SPECS[type],
      warrantyDaysRemaining: 600 - i * 10, userId: u.id, purchaseDate: dateDaysAgo(120 + i * 17),
      originalValue: GEN_VALUES[type], usefulLifeYears: type === 2 ? 3 : 4,
    });
  }),
];

/* ----------------------------------- Domain helpers ------------------------------ */
export const LIFECYCLE = ["OPEN", "SOLVING", "CLOSED"];
export const STEP_LABEL = { OPEN: "Submitted", SOLVING: "Solving", CLOSED: "Resolved" };

export const STATUS_META = {
  OPEN: { tone: "warn", label: "Open" },
  SOLVING: { tone: "brand", label: "Solving" },
  CLOSED: { tone: "ok", label: "Resolved" },
  REJECTED: { tone: "crit", label: "Rejected" },
};
// Repair-shop routing for faulty hardware — decided by warranty status
export const REPAIR_SHOP_WARRANTY = "Original shop (warranty)";
export const REPAIR_SHOP_TRUSTED = "Trusted repair shop";

export const money = (n) => "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

export const KB_ARTICLES = [
  { id: 1, category: "Networking", title: "Connect to SQUARE corporate Wi-Fi", body: "Open network settings, select 'SQUARE-Corp', and sign in with your SQUARE username and password (not your email). If it won't connect, forget the network and rejoin." },
  { id: 2, category: "Printing", title: "Printer driver installation guide", body: "Download the driver for your floor's printer model from the IT portal, run the installer as administrator, and restart the print spooler service if the queue looks stuck." },
  { id: 3, category: "Networking", title: "Set up the company VPN", body: "Install the VPN client from the IT portal, use your SQUARE username, and pick the 'HQ' gateway unless your team was told otherwise." },
  { id: 4, category: "Account", title: "Reset your SQUARE account password", body: "Use the self-service reset link on the login page. Resets take effect immediately, but you may need to sign out and back in on other devices." },
  { id: 5, category: "Hardware", title: "Laptop won't wake from sleep", body: "Hold the power button for 10 seconds to force a restart. If it keeps happening, file a ticket — repeated freezes can indicate a failing battery or RAM." },
  { id: 6, category: "Hardware", title: "Battery draining unusually fast", body: "Check Settings → Battery for a runaway process. If usage looks normal but the battery still drains fast or feels warm/swollen, file a ticket immediately — don't keep using it." },
];
