"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ParentStudentLogsPanel } from "@/components/ParentStudentLogsPanel";
import {
  Button,
  Select,
  PageHeader,
  EmptyState,
  Col,
  Row,
} from "@/components/ui";

export default function FamilyLedgerPage() {
  const students = useQuery(api.students.listForMyFamily);
  const [studentId, setStudentId] = useState("");

  const selectedStudentId = (studentId || students?.[0]?._id || "") as
    | Id<"students">
    | "";

  if (students === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div className="page-stack">
      <PageHeader
        compact
        title="Learning ledger"
        description="Create, edit, delete, or nullify student logs. Nullified entries keep an audit trail and drop out of progress totals."
      />

      {students.length === 0 ? (
        <EmptyState>
          <Link href="/family/dashboard">
            <Button variant="secondary" size="sm">
              Add a student
            </Button>
          </Link>{" "}
          before logging time.
        </EmptyState>
      ) : (
        <>
          <Row gap="sm" className="items-end">
            <Col span={12} md={6}>
              <Select
                label="Student"
                value={selectedStudentId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                {students.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.displayName}
                  </option>
                ))}
              </Select>
            </Col>
            <Col span={12} md={6} className="flex flex-wrap gap-2 pb-1">
              {selectedStudentId ? (
                <>
                  <Link href={`/family/students/${selectedStudentId}?tab=logs`}>
                    <Button variant="secondary" size="sm">
                      Student control center
                    </Button>
                  </Link>
                  <Link href={`/family/progress/${selectedStudentId}`}>
                    <Button variant="ghost" size="sm">
                      Progress
                    </Button>
                  </Link>
                </>
              ) : null}
            </Col>
          </Row>

          {selectedStudentId ? (
            <ParentStudentLogsPanel studentId={selectedStudentId} />
          ) : null}
        </>
      )}
    </div>
  );
}
