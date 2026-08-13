import { useState } from "react";
import { Building2, Layers3, PackagePlus, Plus, Trash2 } from "lucide-react";
import { DEVICE_KINDS, ASSET_CATEGORIES, dateDaysAgo } from "../data/constants";
import { Section } from "./Shell";
import { Btn } from "./primitives";

/* ================================================================================= */
/*  Superuser — Organization: offices, departments and new inventory devices,        */
/*  all managed from the UI so no code change is ever needed.                        */
/* ================================================================================= */
export function OrgPanel({ ds, notify }) {
  const [locName, setLocName] = useState("");
  const [locFloors, setLocFloors] = useState(6);
  const [deptName, setDeptName] = useState("");
  // Same field set as the employee's "Add device" popup, so asset records never conflict
  const emptyDev = {
    deviceKind: "", deviceName: "", serialNumber: "", prNumber: "",
    assetCategory: ASSET_CATEGORIES[1], assetNumber: "", supplierName: "",
    department: "", specifications: "", ipAddress: "", price: "", warrantyExpiry: dateDaysAgo(-365),
  };
  const [dev, setDev] = useState(emptyDev);
  const [busy, setBusy] = useState(false);

  const submitLocation = async (e) => {
    e.preventDefault();
    if (!locName.trim()) { notify("Enter the office name.", "crit"); return; }
    const r = await ds.addLocation(locName.trim(), Number(locFloors) || 6);
    if (r?.ok === false) notify(r.error, "crit");
    else { notify(`Office "${locName.trim()}" added with ${Number(locFloors) || 6} floors.`, "ok"); setLocName(""); setLocFloors(6); }
  };

  const deleteLocation = async (l) => {
    const r = await ds.removeLocation(l.id);
    notify(r?.ok === false ? r.error : `Office "${l.name}" removed.`, r?.ok === false ? "crit" : "ok");
  };

  const submitDepartment = async (e) => {
    e.preventDefault();
    if (!deptName.trim()) { notify("Enter the department name.", "crit"); return; }
    const r = await ds.addDepartment(deptName.trim());
    if (r?.ok === false) notify(r.error, "crit");
    else { notify(`Department "${deptName.trim()}" added.`, "ok"); setDeptName(""); }
  };

  const deleteDepartment = async (d) => {
    const r = await ds.removeDepartment(d.id);
    notify(r?.ok === false ? r.error : `Department "${d.name}" removed.`, r?.ok === false ? "crit" : "ok");
  };

  const submitDevice = async (e) => {
    e.preventDefault();
    if (!dev.deviceKind) { notify("Select the device type.", "crit"); return; }
    if (!dev.deviceName.trim() || !dev.serialNumber.trim()) { notify("Device name and serial number are required.", "crit"); return; }
    if (!dev.prNumber.trim()) { notify("Enter the PR (Purchase Requisition) number.", "crit"); return; }
    if (dev.assetCategory === "Asset" && !dev.assetNumber.trim()) { notify("Enter the asset number for an Asset-category device.", "crit"); return; }
    if (!dev.supplierName.trim()) { notify("Enter the supplier name.", "crit"); return; }
    if (dev.price === "" || !(Number(dev.price) >= 0)) { notify("Enter a valid price.", "crit"); return; }
    if (!dev.warrantyExpiry) { notify("Pick the warranty expiry date.", "crit"); return; }
    if (ds.assets.some((a) => a.serialNumber === dev.serialNumber.trim())) { notify("This serial number already exists.", "crit"); return; }
    setBusy(true);
    const r = await ds.registerDevice({
      deviceType: dev.deviceName.trim(), deviceKind: dev.deviceKind,
      serialNumber: dev.serialNumber.trim(), prNumber: dev.prNumber.trim(),
      assetCategory: dev.assetCategory,
      assetNumber: dev.assetCategory === "Asset" ? dev.assetNumber.trim() : null,
      supplierName: dev.supplierName.trim(), department: dev.department || null,
      specifications: dev.specifications, ipAddress: dev.ipAddress.trim() || null,
      warrantyExpiry: dev.warrantyExpiry,
      originalValue: Number(dev.price) || 0, userId: null, // no owner -> straight into the new-device inventory
    });
    setBusy(false);
    if (r.ok) { notify(`${dev.serialNumber.trim()} added to the IT inventory as a new device.`, "ok"); setDev(emptyDev); }
    else notify("Couldn't add the device.", "crit");
  };

  return (
    <Section eyebrow="Offices · departments · inventory — no developer needed" title="Organization">
      <div className="sq-grid cols-2">
        {/* Offices */}
        <div className="sq-card">
          <div className="sq-pool-head"><Building2 size={16} /> Offices</div>
          <div className="sq-stack" style={{ gap: 8, marginBottom: 14 }}>
            {ds.locations.map((l) => (
              <div key={l.id} className="sq-roster-asset">
                <span className="sq-cell-strong" style={{ flex: 1 }}>{l.name}</span>
                <span className="sq-cell-desc">{l.floors} floor{l.floors === 1 ? "" : "s"}</span>
                <Btn size="sm" variant="danger" icon={Trash2} onClick={() => deleteLocation(l)}>Remove</Btn>
              </div>
            ))}
          </div>
          <form onSubmit={submitLocation} className="sq-form">
            <div className="sq-form-row">
              <label className="sq-field"><span className="sq-label">New office name</span>
                <input className="sq-input" value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="e.g. Gulshan Annex" />
              </label>
              <label className="sq-field"><span className="sq-label">Floors</span>
                <input className="sq-input" type="number" min="1" max="50" value={locFloors} onChange={(e) => setLocFloors(e.target.value)} />
              </label>
            </div>
            <div className="sq-form-actions"><Btn variant="primary" type="submit" icon={Plus}>Add office</Btn></div>
          </form>
        </div>

        {/* Departments */}
        <div className="sq-card">
          <div className="sq-pool-head"><Layers3 size={16} /> Departments</div>
          <div className="sq-stack" style={{ gap: 8, marginBottom: 14 }}>
            {ds.departments.map((d) => (
              <div key={d.id} className="sq-roster-asset">
                <span className="sq-cell-strong" style={{ flex: 1 }}>{d.name}</span>
                <Btn size="sm" variant="danger" icon={Trash2} onClick={() => deleteDepartment(d)}>Remove</Btn>
              </div>
            ))}
          </div>
          <form onSubmit={submitDepartment} className="sq-form">
            <label className="sq-field"><span className="sq-label">New department name</span>
              <input className="sq-input" value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="e.g. Research and Development" />
            </label>
            <div className="sq-form-actions"><Btn variant="primary" type="submit" icon={Plus}>Add department</Btn></div>
          </form>
        </div>
      </div>

      {/* New inventory device — same fields as the employee "Add device" popup.
          Centered on its own row rather than stretched into the 2-col grid, since
          it's a single wide form and left-aligning it under a half-width column
          looked lopsided. */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
        <div className="sq-card" style={{ width: "100%", maxWidth: 560 }}>
          <div className="sq-pool-head"><PackagePlus size={16} /> Add device to IT inventory</div>
          <p className="sq-cell-desc" style={{ marginBottom: 12 }}>New devices land in the IT Team's Inventory tab, ready to be issued with your acceptance.</p>
          <form onSubmit={submitDevice} className="sq-form">
            <div className="sq-form-row">
              <label className="sq-field"><span className="sq-label">Device type</span>
                <select className="sq-input" value={dev.deviceKind} onChange={(e) => setDev({ ...dev, deviceKind: e.target.value })} required>
                  <option value="">Select a type…</option>
                  {DEVICE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
              {dev.deviceKind && (
                <label className="sq-field"><span className="sq-label">Device name</span>
                  <input className="sq-input" value={dev.deviceName} onChange={(e) => setDev({ ...dev, deviceName: e.target.value })} required placeholder="e.g. Model X Laptop" />
                </label>
              )}
            </div>
            <div className="sq-form-row">
              <label className="sq-field"><span className="sq-label">Serial number</span>
                <input className="sq-input" value={dev.serialNumber} onChange={(e) => setDev({ ...dev, serialNumber: e.target.value })} required placeholder="e.g. SQ-90001-DL" />
              </label>
              <label className="sq-field"><span className="sq-label">PR (Purchase Requisition) number</span>
                <input className="sq-input" value={dev.prNumber} onChange={(e) => setDev({ ...dev, prNumber: e.target.value })} required placeholder="e.g. PR-2026-0142" />
              </label>
            </div>
            <div className="sq-form-row">
              <label className="sq-field"><span className="sq-label">Category</span>
                <select className="sq-input" value={dev.assetCategory} onChange={(e) => setDev({ ...dev, assetCategory: e.target.value, assetNumber: "" })}>
                  {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              {dev.assetCategory === "Asset" && (
                <label className="sq-field"><span className="sq-label">Asset number</span>
                  <input className="sq-input" value={dev.assetNumber} onChange={(e) => setDev({ ...dev, assetNumber: e.target.value })} required placeholder="e.g. AST-00871" />
                </label>
              )}
            </div>
            <div className="sq-form-row">
              <label className="sq-field"><span className="sq-label">Supplier name</span>
                <input className="sq-input" value={dev.supplierName} onChange={(e) => setDev({ ...dev, supplierName: e.target.value })} required placeholder="e.g. TechSource BD Ltd." />
              </label>
              <label className="sq-field"><span className="sq-label">Department (optional)</span>
                <select className="sq-input" value={dev.department} onChange={(e) => setDev({ ...dev, department: e.target.value })}>
                  <option value="">— unassigned stock —</option>
                  {ds.departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </label>
            </div>
            <div className="sq-form-row">
              <label className="sq-field"><span className="sq-label">Specifications (optional)</span>
                <input className="sq-input" value={dev.specifications} onChange={(e) => setDev({ ...dev, specifications: e.target.value })} placeholder="e.g. Core i7 · 16GB RAM · 512GB NVMe" />
              </label>
              <label className="sq-field"><span className="sq-label">IP address (optional)</span>
                <input className="sq-input" value={dev.ipAddress} onChange={(e) => setDev({ ...dev, ipAddress: e.target.value })} placeholder="e.g. 10.20.4.117" />
              </label>
            </div>
            <div className="sq-form-row">
              <label className="sq-field"><span className="sq-label">Price (USD)</span>
                <input className="sq-input" type="number" min="0" value={dev.price} onChange={(e) => setDev({ ...dev, price: e.target.value })} required placeholder="e.g. 1400" />
              </label>
              <label className="sq-field"><span className="sq-label">Warranty expiry date</span>
                <input className="sq-input" type="date" value={dev.warrantyExpiry} onChange={(e) => setDev({ ...dev, warrantyExpiry: e.target.value })} required />
              </label>
            </div>
            <div className="sq-form-actions"><Btn variant="primary" type="submit" icon={Plus} disabled={busy}>{busy ? "Adding…" : "Add to inventory"}</Btn></div>
          </form>
        </div>
      </div>
    </Section>
  );
}

