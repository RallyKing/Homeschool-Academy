"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Message,
  Modal,
  PageHeader,
  Section,
  Select,
  Textarea,
} from "@/components/ui";
import {
  configureReadAlongRecognition,
  getSpeechRecognitionCtor,
  tokenizeTranscript,
  wordsMatch,
} from "@/lib/readAlongSpeech";

type ReportStatus = "open" | "testing" | "approved" | "rejected" | "ticketed";
type TicketStatus = "open" | "in_progress" | "resolved";

const REPORT_STATUSES: ReportStatus[] = [
  "open",
  "testing",
  "approved",
  "rejected",
  "ticketed",
];

export default function AdminSpeechReportsPage() {
  const user = useQuery(api.users.current);
  const reports = useQuery(
    api.speechReports.list,
    user?.role === "superAdmin" ? {} : "skip",
  );
  const tickets = useQuery(
    api.speechTickets.list,
    user?.role === "superAdmin" ? {} : "skip",
  );
  const createReport = useMutation(api.speechReports.create);
  const updateReport = useMutation(api.speechReports.update);
  const removeReport = useMutation(api.speechReports.remove);
  const addSample = useMutation(api.speechReports.addSample);
  const approveReport = useMutation(api.speechReports.approve);
  const rejectReport = useMutation(api.speechReports.reject);
  const createTicket = useMutation(api.speechTickets.create);
  const updateTicket = useMutation(api.speechTickets.update);
  const removeTicket = useMutation(api.speechTickets.remove);

  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">(
    "info",
  );
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [editReportId, setEditReportId] = useState("");
  const [reportWord, setReportWord] = useState("");
  const [reportNotes, setReportNotes] = useState("");
  const [reportStatus, setReportStatus] = useState<ReportStatus>("open");
  const [detailId, setDetailId] = useState<Id<"speechWordReports"> | null>(
    null,
  );
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [editTicketId, setEditTicketId] = useState("");
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketBody, setTicketBody] = useState("");
  const [ticketStatus, setTicketStatus] = useState<TicketStatus>("open");

  const detail = reports?.find((r) => r._id === detailId) ?? null;

  function notify(text: string, tone: "info" | "error" | "success" = "info") {
    setMessage(text);
    setMessageTone(tone);
  }

  function openCreateReport() {
    setEditReportId("");
    setReportWord("");
    setReportNotes("");
    setReportStatus("open");
    setReportModalOpen(true);
  }

  function openEditReport(row: {
    _id: Id<"speechWordReports">;
    word: string;
    notes?: string;
    status: ReportStatus;
  }) {
    setEditReportId(row._id);
    setReportWord(row.word);
    setReportNotes(row.notes ?? "");
    setReportStatus(row.status);
    setReportModalOpen(true);
  }

  async function onReportSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reportWord.trim()) return;
    try {
      if (editReportId) {
        await updateReport({
          reportId: editReportId as Id<"speechWordReports">,
          word: reportWord.trim(),
          notes: reportNotes.trim() || undefined,
          status: reportStatus,
        });
        notify("Report updated.", "success");
      } else {
        await createReport({
          word: reportWord.trim(),
          notes: reportNotes.trim() || undefined,
        });
        notify("Report created.", "success");
      }
      setReportModalOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  function openCreateTicket() {
    setEditTicketId("");
    setTicketTitle("");
    setTicketBody("");
    setTicketStatus("open");
    setTicketModalOpen(true);
  }

  function openEditTicket(row: {
    _id: Id<"speechDevTickets">;
    title: string;
    body: string;
    status: TicketStatus;
  }) {
    setEditTicketId(row._id);
    setTicketTitle(row.title);
    setTicketBody(row.body);
    setTicketStatus(row.status);
    setTicketModalOpen(true);
  }

  async function onTicketSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ticketTitle.trim() || !ticketBody.trim()) return;
    try {
      if (editTicketId) {
        await updateTicket({
          ticketId: editTicketId as Id<"speechDevTickets">,
          title: ticketTitle.trim(),
          body: ticketBody.trim(),
          status: ticketStatus,
        });
        notify("Ticket updated.", "success");
      } else {
        await createTicket({
          title: ticketTitle.trim(),
          body: ticketBody.trim(),
          status: ticketStatus,
        });
        notify("Ticket created.", "success");
      }
      setTicketModalOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify("Copied Cursor prompt.", "success");
    } catch {
      notify("Could not copy.", "error");
    }
  }

  if (user === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }
  if (!user) {
    return <p className="text-sm text-[var(--muted)]">Please sign in.</p>;
  }
  if (user.role !== "superAdmin") {
    return (
      <p className="text-sm text-[var(--muted)]">
        SuperAdmin access required.
      </p>
    );
  }

  const navLinks = (
    <div className="flex flex-wrap gap-2">
      <Link href="/admin">
        <Button variant="ghost" size="sm">
          Admin
        </Button>
      </Link>
      <Link href="/admin/knowledge-base">
        <Button variant="secondary" size="sm">
          KB
        </Button>
      </Link>
    </div>
  );

  return (
    <div className="page-stack">
      <PageHeader
        compact
        eyebrow="God Mode"
        title="Speech reports"
        description="Test reported read-along words, then approve a Cursor ticket when ASR is struggling."
        actions={navLinks}
      />
      <Message tone={messageTone}>{message}</Message>

      <Section
        title="Reports"
        action={
          <Button size="sm" onClick={openCreateReport}>
            New report
          </Button>
        }
      >
        {reports === undefined ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : reports.length === 0 ? (
          <EmptyState>No speech reports yet.</EmptyState>
        ) : (
          <div className="space-y-1.5">
            {reports.map((row) => (
              <div key={row._id} className="list-row list-row-dense">
                <div className="min-w-0">
                  <button
                    type="button"
                    className="font-medium hover:underline"
                    onClick={() => setDetailId(row._id)}
                  >
                    {row.word}
                  </button>
                  <Badge tone="neutral" className="ml-2">
                    {row.status}
                  </Badge>
                  <span className="ml-2 text-xs text-[var(--muted)]">
                    {row.reporterRole}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDetailId(row._id)}
                  >
                    Test
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditReport(row)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (!window.confirm(`Delete report “${row.word}”?`)) {
                        return;
                      }
                      void removeReport({ reportId: row._id })
                        .then(() => notify("Report deleted.", "success"))
                        .catch((err) =>
                          notify(
                            err instanceof Error ? err.message : "Failed",
                            "error",
                          ),
                        );
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {detail ? (
        <Card padding="lg" className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-display text-2xl font-semibold">{detail.word}</p>
              <p className="text-sm text-[var(--muted)]">
                {detail.status} · {detail.reporterRole}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() =>
                  void approveReport({ reportId: detail._id })
                    .then(() => notify("Ticket created for Cursor.", "success"))
                    .catch((err) =>
                      notify(
                        err instanceof Error ? err.message : "Failed",
                        "error",
                      ),
                    )
                }
              >
                Approve
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  void rejectReport({ reportId: detail._id })
                    .then(() => notify("Report rejected.", "success"))
                    .catch((err) =>
                      notify(
                        err instanceof Error ? err.message : "Failed",
                        "error",
                      ),
                    )
                }
              >
                Reject
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDetailId(null)}
              >
                Close
              </Button>
            </div>
          </div>
          {detail.notes ? (
            <p className="text-sm">{detail.notes}</p>
          ) : null}
          <SpeechWordTester
            word={detail.word}
            onSave={(transcript) => {
              void addSample({ reportId: detail._id, transcript })
                .then(() => notify("Saved recognition sample.", "success"))
                .catch((err) =>
                  notify(err instanceof Error ? err.message : "Failed", "error"),
                );
            }}
          />
          {(detail.recognitionSamples ?? []).length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase text-[var(--muted)]">
                Samples
              </p>
              {(detail.recognitionSamples ?? []).map((sample, i) => (
                <p key={`${sample.at}-${i}`} className="text-sm">
                  Heard: {sample.transcript}
                </p>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      <Section
        title="Developer tickets"
        action={
          <Button size="sm" onClick={openCreateTicket}>
            New ticket
          </Button>
        }
      >
        {tickets === undefined ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : tickets.length === 0 ? (
          <EmptyState>No tickets yet. Approve a report to create one.</EmptyState>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <Card key={ticket._id} padding="md">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-semibold">{ticket.title}</p>
                    <Badge tone="neutral">{ticket.status}</Badge>
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs">
                      {ticket.body}
                    </pre>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void copyText(ticket.body)}
                    >
                      Copy for Cursor
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditTicket(ticket)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        if (!window.confirm("Delete this ticket?")) return;
                        void removeTicket({ ticketId: ticket._id })
                          .then(() => notify("Ticket deleted.", "success"))
                          .catch((err) =>
                            notify(
                              err instanceof Error ? err.message : "Failed",
                              "error",
                            ),
                          );
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Modal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title={editReportId ? "Edit report" : "New report"}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setReportModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" form="speech-report-form">
              {editReportId ? "Save report" : "Create report"}
            </Button>
          </>
        }
      >
        <form
          id="speech-report-form"
          onSubmit={(e) => void onReportSubmit(e)}
          className="space-y-4"
        >
          <Input
            label="Word"
            value={reportWord}
            onChange={(e) => setReportWord(e.target.value)}
            required
          />
          <Textarea
            label="Notes"
            value={reportNotes}
            onChange={(e) => setReportNotes(e.target.value)}
            rows={3}
          />
          {editReportId ? (
            <Select
              label="Status"
              value={reportStatus}
              onChange={(e) =>
                setReportStatus(e.target.value as ReportStatus)
              }
            >
              {REPORT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        title={editTicketId ? "Edit ticket" : "New ticket"}
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setTicketModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" form="speech-ticket-form">
              {editTicketId ? "Save ticket" : "Create ticket"}
            </Button>
          </>
        }
      >
        <form
          id="speech-ticket-form"
          onSubmit={(e) => void onTicketSubmit(e)}
          className="space-y-4"
        >
          <Input
            label="Title"
            value={ticketTitle}
            onChange={(e) => setTicketTitle(e.target.value)}
            required
          />
          <Textarea
            label="Cursor prompt"
            value={ticketBody}
            onChange={(e) => setTicketBody(e.target.value)}
            rows={10}
            required
          />
          <Select
            label="Status"
            value={ticketStatus}
            onChange={(e) =>
              setTicketStatus(e.target.value as TicketStatus)
            }
          >
            <option value="open">open</option>
            <option value="in_progress">in_progress</option>
            <option value="resolved">resolved</option>
          </Select>
        </form>
      </Modal>
    </div>
  );
}

function SpeechWordTester({
  word,
  onSave,
}: {
  word: string;
  onSave: (transcript: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recRef = useRef<{ stop: () => void; abort: () => void } | null>(null);
  const passed = transcript
    ? tokenizeTranscript(transcript).some((token) => wordsMatch(word, token))
    : false;

  useEffect(() => {
    return () => {
      recRef.current?.abort();
    };
  }, []);

  function stop() {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  }

  function start() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    recRef.current?.abort();
    const rec = new Ctor();
    configureReadAlongRecognition(rec);
    rec.onresult = (event) => {
      let combined = "";
      for (let r = 0; r < event.results.length; r++) {
        combined += `${event.results[r]?.[0]?.transcript ?? ""} `;
      }
      setTranscript(combined.trim());
    };
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border)] p-4">
      <p className="text-sm font-medium">Test word (en-US)</p>
      <div className="flex flex-wrap gap-2">
        <Button
          className="read-along-kid-btn"
          onClick={() => (listening ? stop() : start())}
        >
          {listening ? "Stop" : "Record"}
        </Button>
        <Button
          variant="secondary"
          disabled={!transcript}
          onClick={() => onSave(transcript)}
        >
          Save sample
        </Button>
      </div>
      {transcript ? (
        <p
          className={
            passed
              ? "text-lg font-semibold text-emerald-700"
              : "text-lg font-semibold text-[var(--danger)]"
          }
        >
          Heard: {transcript} {passed ? "· pass" : "· fail"}
        </p>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          Record and compare against “{word}”.
        </p>
      )}
    </div>
  );
}
