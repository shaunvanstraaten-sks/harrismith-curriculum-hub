/**
 * Seed the school's staff as Supabase user accounts.
 *
 * The moderation forms select a teacher by user account (moderation_submissions
 * .teacher_id -> profiles.id), which is what makes "a teacher only sees their own
 * moderations" work. So each staff member needs an account before they can be
 * picked in the "Teacher checked" / "Examiner" dropdowns.
 *
 * Creating each user fires the handle_new_user trigger, which auto-creates the
 * profile (with full_name) and a default 'teacher' role, pending approval.
 *
 * Usage (PowerShell, from the repo root):
 *   $env:SUPABASE_URL="https://tgujrqfokjsdfzulpfau.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="<service_role key from Supabase settings>"
 *   $env:STAFF_EMAIL_DOMAIN="harrismithprimary.co.za"   # optional
 *   node scripts/seed-staff.mjs
 *
 * The service_role key is a SECRET — keep it in your shell only, never commit it.
 * Re-running is safe: existing accounts are skipped, not duplicated.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const domain = process.env.STAFF_EMAIL_DOMAIN || "harrismithprimary.co.za";

if (!url || !key) {
  console.error("Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  process.exit(1);
}

// Staff list, exactly as it appears on the school's Google Forms.
// Add an explicit email as ["Name", "real@address"] to override the generated one.
const STAFF = [
  "L Erasmus",
  "N Fernandez",
  "A Ferreira",
  "J Jacobs",
  "M Jansen",
  "M Jordaan",
  "A Kachelhoffer",
  "A Liebenberg",
  "R Marais",
  "S Naude",
  "D Sekonyela",
  "E van Sandwyk",
  "L van Sandwyk",
  "A van Tonder",
  "E van Wyk",
  "D van Zyl",
  "A Venter",
  "D van Straaten",
  "J van Rooyen",
];

/** "E van Sandwyk" -> "e.vansandwyk@<domain>" */
function emailFor(name) {
  const parts = name.trim().toLowerCase().split(/\s+/);
  const initial = parts[0].replace(/[^a-z]/g, "");
  const surname = parts.slice(1).join("").replace(/[^a-z]/g, "");
  return `${initial}.${surname}@${domain}`;
}

/** Random password — nobody uses it; staff set their own via "Forgot password". */
function tempPassword() {
  return "Hps!" + Math.random().toString(36).slice(2, 12) + "A1";
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = { created: [], skipped: [], failed: [] };

for (const entry of STAFF) {
  const [name, explicitEmail] = Array.isArray(entry) ? entry : [entry, null];
  const email = explicitEmail || emailFor(name);

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword(),
    email_confirm: true, // no confirmation mail; they use "Forgot password" to set one
    user_metadata: { full_name: name, username: email.split("@")[0] },
  });

  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      results.skipped.push(`${name} <${email}>`);
    } else {
      results.failed.push(`${name} <${email}>: ${error.message}`);
    }
  } else {
    results.created.push(`${name} <${email}> ${data.user?.id ?? ""}`);
  }
}

console.log(`\nCreated (${results.created.length}):`);
results.created.forEach((r) => console.log("  + " + r));
console.log(`\nAlready existed (${results.skipped.length}):`);
results.skipped.forEach((r) => console.log("  = " + r));
if (results.failed.length) {
  console.log(`\nFailed (${results.failed.length}):`);
  results.failed.forEach((r) => console.log("  ! " + r));
}
console.log(
  "\nNext: approve them and assign roles (Vakhoof/HOD) under Users in the portal.\n",
);
