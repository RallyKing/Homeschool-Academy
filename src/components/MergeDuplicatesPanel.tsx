"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Message,
  Modal,
  Section,
  Select,
} from "@/components/ui";

type CountRow = { table: string; count: number };
type KeepName = "target" | "source" | "custom";

type MergeReport = {
  dryRun: boolean;
  moved: CountRow[];
  merged: CountRow[];
  deleted: CountRow[];
  warnings: string[];
  survivingName?: string;
  sourceName?: string;
  targetName?: string;
};

function total(rows: CountRow[]) {
  return rows.reduce((sum, row) => sum + row.count, 0);
}

function CountList({ label, rows }: { label: string; rows: CountRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-fg)]">
        {label} ({total(rows)})
      </p>
      <ul className="mt-1 space-y-0.5">
        {rows.map((row) => (
          <li key={`${label}-${row.table}`} className="text-sm text-[var(--muted)]">
            {row.table} — <span className="font-medium">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReportView({ report }: { report: MergeReport }) {
  const nothing =
    total(report.moved) === 0 &&
    total(report.merged) === 0 &&
    total(report.deleted) === 0;
  return (
    <Card padding="sm" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={report.dryRun ? "warning" : "success"}>
          {report.dryRun ? "Preview only" : "Applied"}
        </Badge>
        {report.survivingName ? (
          <Badge tone="accent">Surviving name: {report.survivingName}</Badge>
        ) : null}
      </div>
      {nothing ? (
        <p className="text-sm text-[var(--muted)]">Nothing to change.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <CountList label="Rows moved" rows={report.moved} />
          <CountList label="Rows merged" rows={report.merged} />
          <CountList label="Rows deleted" rows={report.deleted} />
        </div>
      )}
      {report.warnings.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--warning)]">
            Needs a human ({report.warnings.length})
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {report.warnings.map((warning) => (
              <li key={warning} className="text-sm text-[var(--muted)]">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

export function MergeDuplicatesPanel() {
  const schools = useQuery(api.merge.listSchools, {});
  const dupes = useQuery(api.merge.duplicates, {});

  const mergeFamilies = useMutation(api.merge.mergeFamilies);
  const mergeStudents = useMutation(api.merge.mergeStudents);
  const mergeContacts = useMutation(api.merge.mergeContacts);
  const dedupeSchoolContacts = useMutation(api.merge.dedupeSchoolContacts);

  const [sourceFamilyId, setSourceFamilyId] = useState("");
  const [targetFamilyId, setTargetFamilyId] = useState("");
  const [keepName, setKeepName] = useState<KeepName>("target");
  const [customName, setCustomName] = useState("");
  const [report, setReport] = useState<MergeReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"info" | "error" | "success">("info");

  // Which row of each duplicate group survives.
  const [studentKeep, setStudentKeep] = useState<Record<string, string>>({});
  const [contactKeep, setContactKeep] = useState<Record<string, string>>({});

  const schoolOptions = useMemo(() => schools ?? [], [schools]);
  const source = schoolOptions.find((s) => s.family._id === sourceFamilyId);
  const target = schoolOptions.find((s) => s.family._id === targetFamilyId);

  function notify(text: string, nextTone: "info" | "error" | "success" = "info") {
    setMessage(text);
    setTone(nextTone);
  }

  function fail(err: unknown) {
    notify(err instanceof Error ? err.message : "Something went wrong", "error");
  }

  async function runFamilyMerge(dryRun: boolean) {
    if (!sourceFamilyId || !targetFamilyId) {
      notify("Pick both a source and a target school.", "error");
      return;
    }
    if (sourceFamilyId === targetFamilyId) {
      notify("Source and target must be different schools.", "error");
      return;
    }
    if (keepName === "custom" && !customName.trim()) {
      notify("Enter the surviving school name.", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await mergeFamilies({
        sourceFamilyId: sourceFamilyId as Id<"families">,
        targetFamilyId: targetFamilyId as Id<"families">,
        keepName,
        customName: keepName === "custom" ? customName.trim() : undefined,
        dryRun,
      });
      setReport(result);
      notify(
        dryRun
          ? "Preview ready — review the report, then merge."
          : `Merged "${result.sourceName}" into "${result.survivingName}".`,
        dryRun ? "info" : "success",
      );
      if (!dryRun) {
        setSourceFamilyId("");
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  async function runStudentMerge(
    groupKey: string,
    studentIds: Id<"students">[],
    dryRun: boolean,
  ) {
    const keeper = (studentKeep[groupKey] ?? studentIds[0]) as Id<"students">;
    const losers = studentIds.filter((id) => id !== keeper);
    if (losers.length === 0) return;
    setBusy(true);
    try {
      const results = [];
      for (const loser of losers) {
        results.push(
          await mergeStudents({
            sourceStudentId: loser,
            targetStudentId: keeper,
            dryRun,
          }),
        );
      }
      setReport({
        dryRun,
        moved: results.flatMap((r) => r.moved),
        merged: results.flatMap((r) => r.merged),
        deleted: results.flatMap((r) => r.deleted),
        warnings: results.flatMap((r) => r.warnings),
      });
      notify(
        dryRun
          ? "Student merge preview ready."
          : `Merged ${losers.length} duplicate student record(s).`,
        dryRun ? "info" : "success",
      );
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function runContactMerge(
    groupKey: string,
    contactIds: Id<"contacts">[],
    dryRun: boolean,
  ) {
    const keeper = (contactKeep[groupKey] ?? contactIds[0]) as Id<"contacts">;
    const losers = contactIds.filter((id) => id !== keeper);
    if (losers.length === 0) return;
    setBusy(true);
    try {
      const results = [];
      for (const loser of losers) {
        results.push(
          await mergeContacts({
            sourceContactId: loser,
            targetContactId: keeper,
            dryRun,
          }),
        );
      }
      setReport({
        dryRun,
        moved: results.flatMap((r) => r.moved),
        merged: results.flatMap((r) => r.merged),
        deleted: results.flatMap((r) => r.deleted),
        warnings: results.flatMap((r) => r.warnings),
      });
      notify(
        dryRun
          ? "Contact merge preview ready."
          : `Merged ${losers.length} duplicate contact card(s).`,
        dryRun ? "info" : "success",
      );
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function runContactSweep(familyId: Id<"families">, dryRun: boolean) {
    setBusy(true);
    try {
      const result = await dedupeSchoolContacts({ familyId, dryRun });
      setReport(result);
      notify(
        dryRun
          ? `Preview: ${result.contactMerges.length} duplicate card(s) would collapse.`
          : `Collapsed ${result.contactMerges.length} duplicate card(s).`,
        dryRun ? "info" : "success",
      );
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  const duplicateSchools = dupes?.schools ?? [];
  const similarSchools = dupes?.similarSchools ?? [];
  const duplicateStudents = dupes?.students ?? [];
  const duplicateContacts = dupes?.contacts ?? [];
  const nothingDuplicated =
    dupes !== undefined &&
    duplicateSchools.length === 0 &&
    similarSchools.length === 0 &&
    duplicateStudents.length === 0 &&
    duplicateContacts.length === 0;

  return (
    <div className="space-y-8">
      <Section
        title="Merge schools"
        description="Move every student, course, log, contact, and membership from one school into another, then delete the empty shell."
      >
        <Card className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Source school (will be removed)"
              value={sourceFamilyId}
              onChange={(e) => {
                setSourceFamilyId(e.target.value);
                setReport(null);
              }}
            >
              <option value="">Select a school…</option>
              {schoolOptions.map((s) => (
                <option key={s.family._id} value={s.family._id}>
                  {s.family.name} — {s.studentCount} students, {s.logCount} logs
                </option>
              ))}
            </Select>
            <Select
              label="Target school (survives)"
              value={targetFamilyId}
              onChange={(e) => {
                setTargetFamilyId(e.target.value);
                setReport(null);
              }}
            >
              <option value="">Select a school…</option>
              {schoolOptions.map((s) => (
                <option key={s.family._id} value={s.family._id}>
                  {s.family.name} — {s.studentCount} students, {s.logCount} logs
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Surviving name"
              value={keepName}
              onChange={(e) => setKeepName(e.target.value as KeepName)}
            >
              <option value="target">
                Keep target name{target ? ` (${target.family.name})` : ""}
              </option>
              <option value="source">
                Use source name{source ? ` (${source.family.name})` : ""}
              </option>
              <option value="custom">Custom name…</option>
            </Select>
            {keepName === "custom" ? (
              <Input
                label="Custom school name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Ballard Kids Learning"
              />
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void runFamilyMerge(true)}
            >
              Preview merge
            </Button>
            <Button
              variant="danger"
              disabled={busy || !sourceFamilyId || !targetFamilyId}
              onClick={() => setConfirmOpen(true)}
            >
              Merge schools
            </Button>
            {targetFamilyId ? (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void runContactSweep(targetFamilyId as Id<"families">, false)
                }
              >
                Collapse duplicate contacts in target
              </Button>
            ) : null}
          </div>

          <Message tone={tone}>{message}</Message>
          {report ? <ReportView report={report} /> : null}
        </Card>
      </Section>

      <Section
        title="Detected duplicates"
        description="Same-name schools, related names like Ballard Family / Ballard Kids Learning, repeated students inside one school, and multiple contact cards for the same person."
      >
        {dupes === undefined ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : nothingDuplicated ? (
          <EmptyState>No duplicates detected. Everything is deduped.</EmptyState>
        ) : (
          <div className="space-y-5">
            {duplicateSchools.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-fg)]">
                  Schools sharing a name
                </p>
                {duplicateSchools.map((group) => (
                  <Card
                    key={group.normalizedName}
                    padding="sm"
                    className="space-y-2"
                  >
                    {group.families.map((family) => (
                      <div key={family._id} className="list-row list-row-dense">
                        <span className="font-medium">{family.name}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>{family.studentCount} students</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSourceFamilyId(family._id)}
                          >
                            Use as source
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTargetFamilyId(family._id)}
                          >
                            Use as target
                          </Button>
                        </div>
                      </div>
                    ))}
                  </Card>
                ))}
              </div>
            ) : null}

            {similarSchools.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-fg)]">
                  Schools that look related
                </p>
                {similarSchools.map((group) => (
                  <Card key={group.token} padding="sm" className="space-y-2">
                    <p className="text-xs text-[var(--muted)]">
                      Shared word: “{group.token}”
                    </p>
                    {group.families.map((family) => (
                      <div key={family._id} className="list-row list-row-dense">
                        <span className="font-medium">{family.name}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>{family.studentCount} students</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSourceFamilyId(family._id)}
                          >
                            Use as source
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTargetFamilyId(family._id)}
                          >
                            Use as target
                          </Button>
                        </div>
                      </div>
                    ))}
                  </Card>
                ))}
              </div>
            ) : null}

            {duplicateStudents.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-fg)]">
                  Duplicate students
                </p>
                {duplicateStudents.map((group) => {
                  const key = `${group.familyId}:${group.displayName}`;
                  return (
                    <Card key={key} padding="sm" className="space-y-3">
                      <div>
                        <p className="font-medium">{group.displayName}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {group.familyName} — {group.studentIds.length} records
                        </p>
                      </div>
                      <Select
                        label="Keep this record"
                        value={studentKeep[key] ?? group.studentIds[0]}
                        onChange={(e) =>
                          setStudentKeep((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                      >
                        {group.studentIds.map((id) => (
                          <option key={id} value={id}>
                            {id}
                          </option>
                        ))}
                      </Select>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void runStudentMerge(key, group.studentIds, true)
                          }
                        >
                          Preview
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Merge the duplicate records for "${group.displayName}" in ${group.familyName}? This cannot be undone.`,
                              )
                            ) {
                              return;
                            }
                            void runStudentMerge(key, group.studentIds, false);
                          }}
                        >
                          Merge students
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : null}

            {duplicateContacts.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-fg)]">
                  Duplicate contact cards
                </p>
                {duplicateContacts.map((group) => {
                  const ids = group.contacts.map((c) => c._id);
                  const key = ids.join("|");
                  return (
                    <Card key={key} padding="sm" className="space-y-3">
                      <div>
                        <p className="font-medium">{group.label}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {group.familyName ?? "No school"} —{" "}
                          {group.contacts.length} cards
                        </p>
                      </div>
                      <Select
                        label="Keep this card"
                        value={contactKeep[key] ?? ids[0]}
                        onChange={(e) =>
                          setContactKeep((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                      >
                        {group.contacts.map((contact) => (
                          <option key={contact._id} value={contact._id}>
                            {contact.kind}
                            {contact.roleLabel ? ` · ${contact.roleLabel}` : ""}
                            {contact.familyId ? " · school-scoped" : " · global"}
                          </option>
                        ))}
                      </Select>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => void runContactMerge(key, ids, true)}
                        >
                          Preview
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Merge ${group.contacts.length} contact cards for "${group.label}" into one? This cannot be undone.`,
                              )
                            ) {
                              return;
                            }
                            void runContactMerge(key, ids, false);
                          }}
                        >
                          Merge contacts
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}
      </Section>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Merge these schools?"
        description={
          source && target
            ? `"${source.family.name}" will be emptied into "${target.family.name}" and then deleted. This cannot be undone.`
            : "Pick both schools first."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => void runFamilyMerge(false)}
            >
              Merge now
            </Button>
          </>
        }
      >
        {source && target ? (
          <div className="space-y-2 text-sm text-[var(--muted)]">
            <p>
              <span className="font-medium text-[var(--foreground)]">
                Source:
              </span>{" "}
              {source.family.name} — {source.studentCount} students,{" "}
              {source.courseCount} courses, {source.logCount} logs,{" "}
              {source.contactCount} contacts
            </p>
            <p>
              <span className="font-medium text-[var(--foreground)]">
                Target:
              </span>{" "}
              {target.family.name} — {target.studentCount} students,{" "}
              {target.courseCount} courses, {target.logCount} logs,{" "}
              {target.contactCount} contacts
            </p>
            <p>
              <span className="font-medium text-[var(--foreground)]">
                Surviving name:
              </span>{" "}
              {keepName === "custom"
                ? customName.trim() || "(missing)"
                : keepName === "source"
                  ? source.family.name
                  : target.family.name}
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
