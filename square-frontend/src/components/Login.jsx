import { useState } from "react";
import { AlertTriangle, ArrowRight, KeyRound, CheckCircle2 } from "lucide-react";
import { SquareMark, Btn, Modal } from "./primitives";

/* ================================================================================= */
/*  Login                                                                            */
/* ================================================================================= */
export function Login({ onLogin, onForgot }) {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotUser, setForgotUser] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotDone, setForgotDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    const r = await onLogin(username, password);
    if (!r.ok) setErr(r.error || "Couldn't sign in.");
    setBusy(false);
  };

  const submitForgot = async (e) => {
    e.preventDefault();
    if (!forgotUser.trim()) return;
    setForgotBusy(true);
    await onForgot(forgotUser.trim());
    setForgotBusy(false);
    setForgotDone(true);
  };

  const closeForgot = () => { setForgotOpen(false); setForgotUser(""); setForgotDone(false); };

  return (
    <div className="sq-login">
      <div className="sq-login-grid" />
      <div className="sq-login-card">
        <div className="sq-login-brand">
          <SquareMark size={30} />
          <div>
            <div className="sq-wordmark lg">SQUARE</div>
            <div className="sq-brand-sub">IT Operations Portal</div>
          </div>
        </div>
        <h1 className="sq-login-h1">Sign in to your workspace</h1>
        <p className="sq-login-p">Asset custody, repair tickets, and hardware lifecycle — in one place.</p>

        {err && <div className="sq-alert"><AlertTriangle size={15} /> {err}</div>}

        <form onSubmit={submit} className="sq-form">
          <label className="sq-field">
            <span className="sq-label">Username</span>
            <input className="sq-input" value={username} onChange={(e) => setU(e.target.value)} autoFocus required placeholder="e.g. saif" />
          </label>                      
          <label className="sq-field">
            <span className="sq-label">Password</span>
            <input className="sq-input" type="password" value={password} onChange={(e) => setP(e.target.value)} required placeholder="••••••••" />
          </label>
          <Btn variant="primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"} {!busy && <ArrowRight size={16} />}</Btn>
        </form>

        <button type="button" className="sq-login-forgot" onClick={() => setForgotOpen(true)}>
          <KeyRound size={13} /> Forgot password?
        </button>
        <p className="sq-login-foot">Sign in with the credentials provided by your Superuser.</p>
      </div>
              
      <Modal open={forgotOpen} onClose={closeForgot} title="Forgot your password?"
        sub="Your Superuser will reset it and hand you a temporary password.">
        {forgotDone ? (
          <div className="sq-form">
            <div className="sq-comp" style={{ alignItems: "flex-start" }}>
              <CheckCircle2 size={16} color="var(--brand)" style={{ flex: "none", marginTop: 2 }} />
              <span style={{ fontSize: 13.5 }}>
                Done — if that account exists, the Superuser has been notified. Collect your temporary
                password from them, sign in with it, then set your own password in <strong>My Account</strong>.
              </span>
            </div>
            <div className="sq-form-actions"><Btn variant="primary" onClick={closeForgot}>Got it</Btn></div>
          </div>
        ) : (
          <form onSubmit={submitForgot} className="sq-form">
            <label className="sq-field"><span className="sq-label">Your username or e-mail</span>
              <input className="sq-input" value={forgotUser} onChange={(e) => setForgotUser(e.target.value)} required autoFocus placeholder="e.g. saif or you@squaregroup.com" />
            </label>
            <div className="sq-form-actions">
              <Btn type="button" onClick={closeForgot}>Cancel</Btn>
              <Btn variant="primary" type="submit" disabled={forgotBusy}>{forgotBusy ? "Sending…" : "Request reset"}</Btn>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
