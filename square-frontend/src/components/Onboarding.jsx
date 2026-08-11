import { useState } from "react";
import { UserPlus, ArrowRight, ArrowLeft, Check, Copy, PartyPopper } from "lucide-react";
import { DEVICE_KINDS, DESIGNATIONS, UNIQUE_DESIGNATIONS, ASSET_CATEGORIES, HR_ADMIN_DEPT, HR_ADMIN_UNITS, floorsFor, dateDaysAgo } from "../data/constants";
import { Section } from "./Shell";
import { Btn, Modal } from "./primitives";

/* ================================================================================= */
/*  Superuser — 2-step employee onboarding                                           */
/* ================================================================================= */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function OnboardingForm({ ds, user, notify }) {
  const deptNames = ds.departments.map((d) => d.name);
  const locNames = ds.locations.map((l) => l.name);
  const emptyForm = {
    employeeId: "", name: "", dob: "", email: "",
    mobile: "", designation: "", unit: "", department: deptNames[0] || "",
    location: locNames[0] || "", floor: 1, phone: "", deviceKind: "", deviceName: "",
    ipAddress: "", assetCategory: ASSET_CATEGORIES[1], assetNumber: "", prNumber: "",
    supplierName: "", price: "", warrantyExpiry: dateDaysAgo(-365),
  };
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState(null); // { username, password }
  const [copied, setCopied] = useState(false);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  const validateStep1 = () => {
    const e = {};
    if (!form.employeeId.trim()) e.employeeId = "Employee ID is required.";
    else if (ds.users.some((u) => (u.employeeId || "").toLowerCase() === form.employeeId.trim().toLowerCase()))
      e.employeeId = "This Employee ID is already in use.";
    if (!form.name.trim()) e.name = "Name is required.";
    if (!form.dob) e.dob = "Date of birth is required.";
    if (!form.email.trim()) e.email = "E-Mail is required.";
    else if (!EMAIL_RE.test(form.email.trim())) e.email = "Enter a valid e-mail address.";
    else if (ds.users.some((u) => u.username === form.email.trim() || u.email === form.email.trim()))
      e.email = "An account with this e-mail already exists.";
    if (!form.mobile.trim()) e.mobile = "Mobile is required.";
    if (!form.designation) e.designation = "Select a designation.";
    // At most one GM / DGM / AGM / Senior Manager / Manager / Deputy Manager /
    // Assistant Manager per department.
    else if (UNIQUE_DESIGNATIONS.includes(form.designation)) {
      const clash = ds.users.find((u) => !u.offboarded && u.jobTitle === form.designation && u.department === form.department);
      if (clash) e.designation = `${form.department} already has a ${form.designation} (${clash.name}). Only one is allowed per department.`;
    }
    if (form.department === HR_ADMIN_DEPT && !form.unit) e.unit = "Select the unit — HR, Admin or IT.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e = {};
    if (!form.phone.trim()) e.phone = "Emergency contact number is required.";
    if (!form.deviceKind) e.deviceKind = "Select a device type.";
    if (!form.deviceName.trim()) e.deviceName = "Device name is required.";
    if (form.assetCategory === "Asset" && !form.assetNumber.trim()) e.assetNumber = "Asset number is required for an Asset-category device.";
    if (!form.prNumber.trim()) e.prNumber = "PR number is required.";
    if (!form.supplierName.trim()) e.supplierName = "Supplier name is required.";
    if (form.price === "" || !(Number(form.price) >= 0)) e.price = "Enter a valid price.";
    if (!form.warrantyExpiry) e.warrantyExpiry = "Warranty expiry date is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep1()) setStep(2); };

  const submit = async () => {
    if (!validateStep2()) return;
    setBusy(true);
    const r = await ds.onboardEmployee({
      ...form,
      employeeId: form.employeeId.trim(), name: form.name.trim(), email: form.email.trim(),
      mobile: form.mobile.trim(), designation: form.designation, phone: form.phone.trim(),
      deviceName: form.deviceName.trim(), ipAddress: form.ipAddress.trim(),
      assetCategory: form.assetCategory,
      assetNumber: form.assetCategory === "Asset" ? form.assetNumber.trim() : null,
      prNumber: form.prNumber.trim(), supplierName: form.supplierName.trim(),
      originalValue: Number(form.price) || 0, warrantyExpiry: form.warrantyExpiry,
      floor: Number(form.floor),
      managerUsername: user.username,
    });
    setBusy(false);
    if (r.ok) {
      setCreds({ username: form.email.trim(), password: r.tempPassword });
      setCopied(false);
    } else notify(r.error || "Couldn't onboard the employee.", "crit");
  };

  const copyCreds = () => {
    navigator.clipboard?.writeText(`Username: ${creds.username}\nTemporary Password: ${creds.password}`);
    setCopied(true);
    notify("Credentials copied to clipboard.", "ok");
  };

  const closeCreds = () => { setCreds(null); setForm(emptyForm); setStep(1); setErrors({}); };

  const field = (key, label, input) => (
    <label className="sq-field"><span className="sq-label">{label}</span>
      {input}
      {errors[key] && <span className="sq-field-err">{errors[key]}</span>}
    </label>
  );

  return (
    <Section eyebrow="Every employee is added manually by the Superuser" title="Employee onboarding">
      <div className="sq-card sq-onboard">
        {/* Step indicator */}
        <div className="sq-steps">
          <div className={`sq-steps-item${step === 1 ? " is-active" : " is-done"}`}>
            <span className="sq-steps-dot">{step > 1 ? <Check size={12} strokeWidth={3} /> : "1"}</span>
            Employee Identity &amp; Organization
          </div>
          <div className="sq-steps-bar" />
          <div className={`sq-steps-item${step === 2 ? " is-active" : ""}`}>
            <span className="sq-steps-dot">2</span>
            Workspace &amp; Asset Allocation
          </div>
        </div>

        {step === 1 ? (
          <div className="sq-form">
            <div className="sq-form-row">
              {field("employeeId", "Employee ID (unique)",
                <input className="sq-input" value={form.employeeId} onChange={(e) => set("employeeId", e.target.value)} placeholder="e.g. SQ-EMP-0100" />)}
              {field("name", "Name",
                <input className="sq-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Ayesha Siddiqua" />)}
            </div>
            <div className="sq-form-row">
              {field("dob", "DOB",
                <input className="sq-input" type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} />)}
            </div>
            <div className="sq-form-row">
              {field("email", "E-Mail",
                <input className="sq-input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="e.g. ayesha@squaregroup.com" />)}
              {field("mobile", "Mobile",
                <input className="sq-input" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="e.g. +8801712345678" />)}
            </div>
            <div className="sq-form-row">
              {field("designation", "Designation",
                <select className="sq-input" value={form.designation} onChange={(e) => set("designation", e.target.value)}>
                  <option value="">Select a designation…</option>
                  {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>)}
              {field("department", "Department",
                <select className="sq-input" value={form.department} onChange={(e) => { set("department", e.target.value); set("unit", ""); }}>
                  {deptNames.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>)}
            </div>
            {form.department === HR_ADMIN_DEPT && (
              field("unit", "Unit (HR and Admin has three)",
                <select className="sq-input" value={form.unit} onChange={(e) => set("unit", e.target.value)}>
                  <option value="">Select a unit…</option>
                  {HR_ADMIN_UNITS.map((u) => <option key={u} value={u}>{u}{u === "IT" ? " (joins the IT Team)" : ""}</option>)}
                </select>)
            )}
            <div className="sq-form-actions">
              <Btn variant="primary" onClick={next}>Next <ArrowRight size={15} /></Btn>
            </div>
          </div>
        ) : (
          <div className="sq-form">
            <div className="sq-form-row">
              {field("location", "Location",
                <select className="sq-input" value={form.location} onChange={(e) => { set("location", e.target.value); set("floor", 1); }}>
                  {locNames.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>)}
              {field("floor", "Floor",
                <select className="sq-input" value={form.floor} onChange={(e) => set("floor", e.target.value)}>
                  {floorsFor(form.location, ds.locations).map((f) => <option key={f} value={f}>Floor {f}</option>)}
                </select>)}
            </div>
            <div className="sq-form-row">
              {field("phone", "Emergency contact number",
                <input className="sq-input" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="e.g. +8801811223344" />)}
              {field("deviceKind", "Device Type",
                <select className="sq-input" value={form.deviceKind} onChange={(e) => set("deviceKind", e.target.value)}>
                  <option value="">Select a type…</option>
                  {DEVICE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>)}
            </div>
            <div className="sq-form-row">
              {field("deviceName", "Device Name",
                <input className="sq-input" value={form.deviceName} onChange={(e) => set("deviceName", e.target.value)} placeholder="e.g. Model X Laptop" />)}
              {field("ipAddress", "IP Address (optional)",
                <input className="sq-input" value={form.ipAddress} onChange={(e) => set("ipAddress", e.target.value)} placeholder="e.g. 10.20.4.117" />)}
            </div>
            <div className="sq-form-row">
              {field("assetCategory", "Category",
                <select className="sq-input" value={form.assetCategory} onChange={(e) => { set("assetCategory", e.target.value); set("assetNumber", ""); }}>
                  {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>)}
              {form.assetCategory === "Asset" && field("assetNumber", "Asset Number",
                <input className="sq-input" value={form.assetNumber} onChange={(e) => set("assetNumber", e.target.value)} placeholder="e.g. AST-00912" />)}
            </div>
            <div className="sq-form-row">
              {field("supplierName", "Supplier name",
                <input className="sq-input" value={form.supplierName} onChange={(e) => set("supplierName", e.target.value)} placeholder="e.g. TechSource BD Ltd." />)}
              {field("price", "Price (USD)",
                <input className="sq-input" type="number" min="0" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="e.g. 1400" />)}
            </div>
            <div className="sq-form-row">
              {field("prNumber", "PR (Purchase Requisition) number",
                <input className="sq-input" value={form.prNumber} onChange={(e) => set("prNumber", e.target.value)} placeholder="e.g. PR-2026-0201" />)}
              {field("warrantyExpiry", "Warranty expiry date",
                <input className="sq-input" type="date" value={form.warrantyExpiry} onChange={(e) => set("warrantyExpiry", e.target.value)} />)}
            </div>
            <div className="sq-form-actions">
              <Btn onClick={() => setStep(1)}><ArrowLeft size={15} /> Back</Btn>
              <Btn variant="primary" icon={UserPlus} onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Submit"}</Btn>
            </div>
          </div>
        )}
      </div>

      {/* Success — credentials for the Superuser to copy and share */}
      <Modal open={!!creds} onClose={closeCreds} title="Employee Added Successfully!" sub="Share these login credentials with the new hire.">
        {creds && (
          <div className="sq-form">
            <div className="sq-token" style={{ textAlign: "left" }}>
              <div className="sq-comp" style={{ marginBottom: 10 }}><PartyPopper size={16} /> The account is live — they can sign in right away and change the password from My Account.</div>
              <div className="sq-token-row"><span className="sq-eyebrow">Username</span><span className="sq-mono">{creds.username}</span></div>
              <div className="sq-token-row"><span className="sq-eyebrow">Temporary Password</span><span className="sq-mono">{creds.password}</span></div>
            </div>
            <div className="sq-form-actions">
              <Btn icon={copied ? Check : Copy} onClick={copyCreds}>{copied ? "Copied!" : "Copy Credentials"}</Btn>
              <Btn variant="primary" onClick={closeCreds}>Done</Btn>
            </div>
          </div>
        )}
      </Modal>
    </Section>
  );
}
