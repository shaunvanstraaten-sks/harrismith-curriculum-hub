#!/usr/bin/env node
// Admin-only utility: uploads a file into the Resources library (Supabase
// Storage 'resources' bucket + public.resources row) using the service-role
// key, bypassing RLS entirely.
//
// Requires SUPABASE_URL (in .env) and SUPABASE_SERVICE_ROLE_KEY (in the
// gitignored .env.local — never commit that key).
//
// Usage:
//   node scripts/upload-resource.mjs \
//     --file "C:\path\to\file.pdf" \
//     --phase intermediate \
//     --category ATP \
//     --grade "Grade 4" \
//     --subject "Afrikaans First Additional Language" \
//     [--title "Custom title"]

import { readFileSync, existsSync } from "node:fs";
import { basename } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path, target) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\n]*?)"?\s*$/);
    if (m) target[m[1]] = m[2];
  }
}

const env = {};
loadEnvFile(new URL("../.env", import.meta.url), env);
loadEnvFile(new URL("../.env.local", import.meta.url), env);

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL (.env) or SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      out[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
for (const r of ["file", "phase", "category", "grade", "subject"]) {
  if (!args[r]) {
    console.error(`Missing --${r}`);
    process.exit(1);
  }
}
if (!["intermediate", "senior"].includes(args.phase)) {
  console.error('--phase must be "intermediate" or "senior"');
  process.exit(1);
}
if (!existsSync(args.file)) {
  console.error(`File not found: ${args.file}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const { data: grade, error: gErr } = await supabase.from("grades").select("id, name").eq("name", args.grade).maybeSingle();
  if (gErr) throw gErr;
  if (!grade) throw new Error(`Grade not found: "${args.grade}"`);

  const { data: subject, error: sErr } = await supabase.from("subjects").select("id, name").eq("name", args.subject).maybeSingle();
  if (sErr) throw sErr;
  if (!subject) throw new Error(`Subject not found: "${args.subject}"`);

  const fileName = basename(args.file);
  const fileBuffer = readFileSync(args.file);
  const path = `${args.phase}/${args.category}/${grade.id}/${subject.id}/${Date.now()}-${fileName}`;

  const { error: upErr } = await supabase.storage.from("resources").upload(path, fileBuffer, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data: row, error: insErr } = await supabase
    .from("resources")
    .insert({
      phase: args.phase,
      category: args.category,
      grade_id: grade.id,
      subject_id: subject.id,
      title: args.title || fileName,
      file_path: path,
      file_name: fileName,
      file_size: fileBuffer.length,
    })
    .select("id")
    .single();
  if (insErr) throw insErr;

  const { data: pub } = supabase.storage.from("resources").getPublicUrl(path);
  console.log(`Uploaded. Resource id: ${row.id}`);
  console.log(`Public URL: ${pub.publicUrl}`);
}

main().catch((e) => {
  console.error("Upload failed:", e.message ?? e);
  process.exit(1);
});
