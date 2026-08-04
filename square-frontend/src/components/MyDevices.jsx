import { useState } from "react";
import { Plus, HardDrive, AlertTriangle } from "lucide-react";
import { DEVICE_KINDS, ASSET_CATEGORIES, deviceIconFor, dateDaysAgo } from "../data/constants";
import { Section } from "./Shell";
import { Btn, Empty, Badge, CopyChip, Modal } from "./primitives";

/* ================================================================================= */
/*  My devices — shared by the User, Superuser and IT Team dashboards.               */
/*  Company rule: nobody works without a device — a red alert shows until at least   */
/*  one device is assigned or registered.                                            */
/* ================================================================================= */
export function MyDevicesPanel({ ds, user, notify, extraAction }) {
  const deptNames = ds.departments.map((d) => d.name);
  const [addOpen, setAddOpen] = useState(false);
  const emptyDeviceForm = {
    deviceKind: "", deviceName: "", serialNumber: "", prNumber: "",
    assetCategory: ASSET_CATEGORIES[1], assetNumber: "", supplierName: "",
    department: deptNames[0] || "", specifications: "", ipAddress: "", price: "", warrantyExpiry: dateDaysAgo(-365),
  };
  const [deviceForm, setDeviceForm] = useState(emptyDeviceForm);
  const [deviceBusy, setDeviceBusy] = useState(false);

  const myAssets = ds.assets.filter((a) => a.userId === user.id);

  const submitDevice = async (e) => {
    e.preventDefault();
    if (!deviceForm.deviceKind) { notify("Select the device type.", "crit"); return; }
    if (!deviceForm.deviceName.trim() || !deviceForm.serialNumber.trim() || !deviceForm.warrantyExpiry) {
      notify("Device name, serial number, and warranty expiry are required.", "crit"); return;
    }
    if (!deviceForm.prNumber.trim()) { notify("Enter the PR (Purchase Requisition) number.", "crit"); return; }
    if (deviceForm.assetCategory === "Asset" && !deviceForm.assetNumber.trim()) {
      notify("Enter the asset number for an Asset-category device.", "crit"); return;
    }
    if (!deviceForm.supplierName.trim()) { notify("Enter the supplier name.", "crit"); return; }
    if (deviceForm.price !== "" && !(Number(deviceForm.price) >= 0)) {
      notify("Enter a valid price.", "crit"); return;
    }
    setDeviceBusy(true);
    const r = await ds.registerDevice({
      deviceType: deviceForm.deviceName.trim(), deviceKind: deviceForm.deviceKind,
      serialNumber: deviceForm.serialNumber.trim(), prNumber: deviceForm.prNumber.trim(),
      assetCategory: deviceForm.assetCategory,
      assetNumber: deviceForm.assetCategory === "Asset" ? deviceForm.assetNumber.trim() : null,
      supplierName: deviceForm.supplierName.trim(), department: deviceForm.department,
      specifications: deviceForm.specifications, ipAddress: deviceForm.ipAddress.trim() || null,
      warrantyExpiry: deviceForm.warrantyExpiry,
      originalValue: Number(deviceForm.price) || 0, userId: user.id,
    });
    setDeviceBusy(false);
    if (r.ok) { setAddOpen(false); setDeviceForm(emptyDeviceForm); notify("Device registered — its price is added to the company capital.", "ok"); }
    else notify("Couldn't register the device.", "crit");
  };

  return (
    <Section eyebrow="Assigned to you" title="My devices" action={
      <div className="sq-row-actions">
        <Btn icon={Plus} onClick={() => setAddOpen(true)}>Add device</Btn>
        {extraAction}
      </div>
    }>
      {myAssets.length === 0 && (
        <div className="sq-card" style={{ marginBottom: 16, borderColor: "#E8112D55" }}>
          <div className="sq-comp" style={{ fontWeight: 600 }}>
            <AlertTriangle size={15} color="var(--crit-ink)" />
            <span className="sq-neg">Error: no device assigned — nobody works without a device at SQUARE. Add a device now, or ask the Superuser to assign one.</span>
          </div>
        </div>
      )}
      {myAssets.length === 0 ? (
        <Empty icon={HardDrive} title="No devices assigned" hint="Hardware assigned to you by IT will show up here, or register one yourself with 'Add device'." />
      ) : (
        <div className="sq-grid cols-2">
          {myAssets.map((a) => {
            const ok = a.warrantyDaysRemaining > 0;
            const Ic = deviceIconFor(a);
            return (
              <div key={a.id} className={`sq-card sq-device ${ok ? "ok" : "crit"}`}>
                <div className="sq-device-head">
                  <span className="sq-device-ic"><Ic size={18} /></span>
                  <div className="sq-device-name">{a.deviceType}</div>
                  <Badge tone={ok ? "ok" : "crit"}>{ok ? "Under warranty" : "Out of warranty"}</Badge>
                </div>
                <div className="sq-device-specs">{a.specifications}{a.ipAddress ? `${a.specifications ? " · " : ""}IP ${a.ipAddress}` : ""}</div>
                <div className="sq-device-foot">
                  <CopyChip text={a.serialNumber} />
                  <span className="sq-mono sq-dim">{ok ? `${a.warrantyDaysRemaining} days left` : "Expired"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a device" sub="Register hardware assigned to you.">
        <form onSubmit={submitDevice} className="sq-form">
          <div className="sq-form-row">
            <label className="sq-field"><span className="sq-label">Device type</span>
              <select className="sq-input" value={deviceForm.deviceKind} onChange={(e) => setDeviceForm({ ...deviceForm, deviceKind: e.target.value })} required>
                <option value="">Select a type…</option>
                {DEVICE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            {deviceForm.deviceKind && (
              <label className="sq-field"><span className="sq-label">Device name</span>
                <input className="sq-input" value={deviceForm.deviceName} onChange={(e) => setDeviceForm({ ...deviceForm, deviceName: e.target.value })} required placeholder={`e.g. ${deviceForm.deviceKind === "Printer" ? "LaserJet Pro M404" : deviceForm.deviceKind === "Mobile" ? "SQUARE Mobile Unit" : "Model X Laptop"}`} />
              </label>
            )}
          </div>
          <div className="sq-form-row">
            <label className="sq-field"><span className="sq-label">Serial number</span>
              <input className="sq-input" value={deviceForm.serialNumber} onChange={(e) => setDeviceForm({ ...deviceForm, serialNumber: e.target.value })} required placeholder="e.g. SQ-12345-DL" />
            </label>
            <label className="sq-field"><span className="sq-label">PR (Purchase Requisition) number</span>
              <input className="sq-input" value={deviceForm.prNumber} onChange={(e) => setDeviceForm({ ...deviceForm, prNumber: e.target.value })} required placeholder="e.g. PR-2026-0142" />
            </label>
          </div>
          <div className="sq-form-row">
            <label className="sq-field"><span className="sq-label">Category</span>
              <select className="sq-input" value={deviceForm.assetCategory} onChange={(e) => setDeviceForm({ ...deviceForm, assetCategory: e.target.value, assetNumber: "" })}>
                {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            {deviceForm.assetCategory === "Asset" && (
              <label className="sq-field"><span className="sq-label">Asset number</span>
                <input className="sq-input" value={deviceForm.assetNumber} onChange={(e) => setDeviceForm({ ...deviceForm, assetNumber: e.target.value })} required placeholder="e.g. AST-00871" />
              </label>
            )}
          </div>
          <div className="sq-form-row">
            <label className="sq-field"><span className="sq-label">Supplier name</span>
              <input className="sq-input" value={deviceForm.supplierName} onChange={(e) => setDeviceForm({ ...deviceForm, supplierName: e.target.value })} required placeholder="e.g. TechSource BD Ltd." />
            </label>
            <label className="sq-field"><span className="sq-label">Department</span>
              <select className="sq-input" value={deviceForm.department} onChange={(e) => setDeviceForm({ ...deviceForm, department: e.target.value })}>
                {deptNames.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          </div>
          <div className="sq-form-row">
            <label className="sq-field"><span className="sq-label">Specifications (optional)</span>
              <input className="sq-input" value={deviceForm.specifications} onChange={(e) => setDeviceForm({ ...deviceForm, specifications: e.target.value })} placeholder="e.g. Core i7 · 16GB RAM · 512GB NVMe" />
            </label>
            <label className="sq-field"><span className="sq-label">IP address (optional)</span>
              <input className="sq-input" value={deviceForm.ipAddress} onChange={(e) => setDeviceForm({ ...deviceForm, ipAddress: e.target.value })} placeholder="e.g. 10.20.4.117" />
            </label>
          </div>
          <div className="sq-form-row">
            <label className="sq-field"><span className="sq-label">Price (USD)</span>
              <input className="sq-input" type="number" min="0" step="1" value={deviceForm.price} onChange={(e) => setDeviceForm({ ...deviceForm, price: e.target.value })} required placeholder="e.g. 1400" />
            </label>
            <label className="sq-field"><span className="sq-label">Warranty expiry date</span>
              <input className="sq-input" type="date" value={deviceForm.warrantyExpiry} onChange={(e) => setDeviceForm({ ...deviceForm, warrantyExpiry: e.target.value })} required />
            </label>
          </div>
          <div className="sq-form-actions">
            <Btn type="button" onClick={() => setAddOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" disabled={deviceBusy}>{deviceBusy ? "Adding…" : "Add device"}</Btn>
          </div>
        </form>
      </Modal>
    </Section>
  );
}
