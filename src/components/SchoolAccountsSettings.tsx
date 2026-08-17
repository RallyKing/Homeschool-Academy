"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Message,
  Modal,
  Section,
  Select,
  TabPanel,
  Tabs,
  Textarea,
} from "@/components/ui";
import { withDuplicateNameOverride } from "@/lib/duplicateName";

type AccountTab = "school" | "parents" | "teachers" | "students" | "contacts";
type SchoolRole = "admin" | "regular";
type StaffKind = "teacher" | "tutor";

export function SchoolAccountsSettings({
  familyId: forcedFamilyId,
  defaultTab = "school",
}: {
  familyId?: Id<"families">;
  defaultTab?: AccountTab;
}) {
  const user = useQuery(api.users.current);
  const schools = useQuery(api.schools.listMine);
  const [selectedId, setSelectedId] = useState<Id<"families"> | "">("");
  const [tab, setTab] = useState<AccountTab>(defaultTab);

  const familyId = (forcedFamilyId || selectedId || schools?.[0]?.family._id) as
    | Id<"families">
    | undefined;

  const caps = useQuery(
    api.schools.getCapabilities,
    familyId ? { familyId } : {},
  );
  const parents = useQuery(
    api.schools.listParents,
    familyId ? { familyId } : "skip",
  );
  const teachers = useQuery(
    api.schools.listTeachers,
    familyId ? { familyId } : "skip",
  );
  const students = useQuery(
    api.students.listForFamily,
    familyId ? { familyId } : "skip",
  );
  const courses = useQuery(
    api.courses.listForFamily,
    familyId ? { familyId } : "skip",
  );
  const contacts = useQuery(
    api.contacts.list,
    familyId ? { familyId } : "skip",
  );

  const createSchool = useMutation(api.schools.createWithMainParent);
  const addParent = useMutation(api.schools.addParent);
  const updateParentRole = useMutation(api.schools.updateParentRole);
  const removeParent = useMutation(api.schools.removeParent);
  const addTeacher = useMutation(api.schools.addTeacher);
  const updateTeacher = useMutation(api.schools.updateTeacher);
  const removeTeacher = useMutation(api.schools.removeTeacher);
  const createStudent = useMutation(api.students.create);
  const updateStudent = useMutation(api.students.update);
  const removeStudent = useMutation(api.students.remove);
  const createContact = useMutation(api.contacts.create);
  const updateContact = useMutation(api.contacts.update);
  const removeContact = useMutation(api.contacts.remove);
  const backfill = useMutation(api.schools.backfillHierarchy);
  const updateFamily = useMutation(api.families.update);

  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">(
    "info",
  );

  const [schoolName, setSchoolName] = useState("");
  const [mainName, setMainName] = useState("");
  const [mainEmail, setMainEmail] = useState("");
  const [mainPhone, setMainPhone] = useState("");

  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentRole, setParentRole] = useState<SchoolRole>("regular");

  const [teacherOpen, setTeacherOpen] = useState(false);
  const [editTeacherId, setEditTeacherId] = useState<Id<"users"> | "">("");
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherPhone, setTeacherPhone] = useState("");
  const [teacherKind, setTeacherKind] = useState<StaffKind>("teacher");
  const [teacherNotes, setTeacherNotes] = useState("");
  const [teacherStudents, setTeacherStudents] = useState<Id<"students">[]>([]);
  const [teacherCourses, setTeacherCourses] = useState<Id<"courses">[]>([]);

  const [studentName, setStudentName] = useState("");
  const [studentLevel, setStudentLevel] = useState("");
  const [editStudentId, setEditStudentId] = useState<Id<"students"> | "">("");

  const [contactOpen, setContactOpen] = useState(false);
  const [editContactId, setEditContactId] = useState<Id<"contacts"> | "">("");
  const [contactName, setContactName] = useState("");
  const [contactKind, setContactKind] = useState<
    "school" | "parent" | "teacher" | "tutor" | "student" | "user"
  >("parent");
  const [contactEmails, setContactEmails] = useState("");
  const [contactPhones, setContactPhones] = useState("");
  const [contactNotes, setContactNotes] = useState("");
  const [renameDraft, setRenameDraft] = useState<string | null>(null);

  const selectedSchool = useMemo(
    () => schools?.find((s) => s.family._id === familyId)?.family,
    [familyId, schools],
  );

  function notify(text: string, tone: "info" | "error" | "success" = "success") {
    setMessage(text);
    setMessageTone(tone);
  }

  const canAddSchool = caps?.canAddSchool ?? user?.role === "superAdmin";
  const canManage = caps?.canManageAccounts ?? false;
  const locked = !familyId;

  async function onCreateSchool(e: FormEvent) {
    e.preventDefault();
    try {
      const result = await withDuplicateNameOverride((allowDuplicateName) =>
        createSchool({
          schoolName: schoolName.trim(),
          mainParentEmail: mainEmail.trim(),
          mainParentName: mainName.trim() || undefined,
          mainParentPhone: mainPhone.trim() || undefined,
          allowDuplicateName,
        }),
      );
      setSelectedId(result.familyId);
      setSchoolName("");
      setMainName("");
      setMainEmail("");
      setMainPhone("");
      void backfill({ familyId: result.familyId }).catch(() => undefined);
      notify(
        result.createdUser
          ? "School created. Main parent should sign up with that email (invite email needs Resend)."
          : "School created and attached to the existing parent account.",
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  async function onRenameSchool(e: FormEvent) {
    e.preventDefault();
    if (!familyId) return;
    const next = (renameDraft ?? selectedSchool?.name ?? "").trim();
    if (!next) return;
    try {
      await withDuplicateNameOverride((allowDuplicateName) =>
        updateFamily({ familyId, name: next, allowDuplicateName }),
      );
      notify("School name updated.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  async function onAddParent(e: FormEvent) {
    e.preventDefault();
    if (!familyId) return;
    try {
      const result = await addParent({
        familyId,
        email: parentEmail.trim(),
        name: parentName.trim() || undefined,
        phone: parentPhone.trim() || undefined,
        schoolRole: parentRole,
      });
      setParentEmail("");
      setParentName("");
      setParentPhone("");
      notify(
        result.createdUser
          ? "Parent added. They can sign up with this email."
          : "Parent attached to this school.",
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  function openTeacher(edit?: {
    userId: Id<"users">;
    name?: string;
    email?: string;
    phone?: string;
    memberKind: StaffKind;
    studentIds: Id<"students">[];
    courseIds: Id<"courses">[];
  }) {
    if (edit) {
      setEditTeacherId(edit.userId);
      setTeacherName(edit.name ?? "");
      setTeacherEmail(edit.email ?? "");
      setTeacherPhone(edit.phone ?? "");
      setTeacherKind(edit.memberKind);
      setTeacherStudents(edit.studentIds);
      setTeacherCourses(edit.courseIds);
    } else {
      setEditTeacherId("");
      setTeacherName("");
      setTeacherEmail("");
      setTeacherPhone("");
      setTeacherKind("teacher");
      setTeacherStudents([]);
      setTeacherCourses([]);
      setTeacherNotes("");
    }
    setTeacherOpen(true);
  }

  async function onSaveTeacher(e: FormEvent) {
    e.preventDefault();
    if (!familyId) return;
    try {
      if (editTeacherId) {
        await updateTeacher({
          familyId,
          userId: editTeacherId,
          name: teacherName.trim() || undefined,
          phone: teacherPhone.trim() || undefined,
          memberKind: teacherKind,
          studentIds: teacherStudents,
          courseIds: teacherCourses,
          notes: teacherNotes.trim() || undefined,
        });
        notify("Teacher updated.");
      } else {
        const result = await addTeacher({
          familyId,
          email: teacherEmail.trim(),
          name: teacherName.trim() || undefined,
          phone: teacherPhone.trim() || undefined,
          memberKind: teacherKind,
          studentIds: teacherStudents,
          courseIds: teacherCourses,
          notes: teacherNotes.trim() || undefined,
        });
        notify(
          result.createdUser
            ? "Teacher added. They can sign up with this email."
            : "Teacher attached and scoped.",
        );
      }
      setTeacherOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  async function onAddStudent(e: FormEvent) {
    e.preventDefault();
    if (!familyId || !studentName.trim()) return;
    try {
      if (editStudentId) {
        await withDuplicateNameOverride((allowDuplicateName) =>
          updateStudent({
            studentId: editStudentId,
            displayName: studentName.trim(),
            academicLevel: studentLevel.trim() || undefined,
            allowDuplicateName,
          }),
        );
        notify("Student updated.");
      } else {
        await withDuplicateNameOverride((allowDuplicateName) =>
          createStudent({
            familyId,
            displayName: studentName.trim(),
            academicLevel: studentLevel.trim() || undefined,
            allowDuplicateName,
          }),
        );
        notify("Student added.");
      }
      setStudentName("");
      setStudentLevel("");
      setEditStudentId("");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  function openContact(edit?: {
    _id: Id<"contacts">;
    displayName: string;
    kind: typeof contactKind;
    emails: string[];
    phones: string[];
    notes?: string;
  }) {
    if (edit) {
      setEditContactId(edit._id);
      setContactName(edit.displayName);
      setContactKind(edit.kind);
      setContactEmails(edit.emails.join(", "));
      setContactPhones(edit.phones.join(", "));
      setContactNotes(edit.notes ?? "");
    } else {
      setEditContactId("");
      setContactName("");
      setContactKind("parent");
      setContactEmails("");
      setContactPhones("");
      setContactNotes("");
    }
    setContactOpen(true);
  }

  async function onSaveContact(e: FormEvent) {
    e.preventDefault();
    if (!familyId) return;
    const emails = contactEmails
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const phones = contactPhones
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      if (editContactId) {
        await updateContact({
          contactId: editContactId,
          displayName: contactName.trim(),
          kind: contactKind,
          emails,
          phones,
          notes: contactNotes.trim() || undefined,
        });
        notify("Contact updated.");
      } else {
        await withDuplicateNameOverride((allowDuplicateName) =>
          createContact({
            familyId,
            kind: contactKind,
            displayName: contactName.trim(),
            emails,
            phones,
            notes: contactNotes.trim() || undefined,
            allowDuplicateName,
          }),
        );
        notify("Contact created.");
      }
      setContactOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  if (user === undefined || schools === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <Message tone={messageTone}>{message}</Message>

      {!forcedFamilyId && schools.length > 0 ? (
        <Select
          label="School"
          value={familyId ?? ""}
          onChange={(e) => setSelectedId(e.target.value as Id<"families">)}
        >
          {schools.map((s) => (
            <option key={s.family._id} value={s.family._id}>
              {s.family.name}
            </option>
          ))}
        </Select>
      ) : null}

      <Tabs
        size="sm"
        tabs={[
          { id: "school", label: "School" },
          { id: "parents", label: "Parents", count: parents?.length },
          { id: "teachers", label: "Teachers", count: teachers?.length },
          { id: "students", label: "Students", count: students?.length },
          { id: "contacts", label: "Contacts", count: contacts?.length },
        ]}
        value={tab}
        onChange={(id) => setTab(id as AccountTab)}
      />

      <TabPanel id="school" active={tab === "school"}>
        <Section
          title="Create school first"
          description="A school is created together with its main parent. Additional parents and teachers come after."
        >
          {canAddSchool ? (
            <form onSubmit={(e) => void onCreateSchool(e)} className="space-y-3">
              <Input
                label="School name"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                required
              />
              <Input
                label="Main parent name"
                value={mainName}
                onChange={(e) => setMainName(e.target.value)}
              />
              <Input
                type="email"
                label="Main parent email"
                value={mainEmail}
                onChange={(e) => setMainEmail(e.target.value)}
                required
                hint="If they already have an account, it will be attached. Otherwise they sign up with this email."
              />
              <Input
                label="Phone (optional)"
                value={mainPhone}
                onChange={(e) => setMainPhone(e.target.value)}
              />
              <Button type="submit" size="sm">
                Create school + main parent
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  void backfill({ familyId })
                    .then((r) =>
                      notify(
                        `Synced ${r.families} schools, ${r.contacts} contacts.`,
                      ),
                    )
                    .catch((err) =>
                      notify(
                        err instanceof Error ? err.message : "Failed",
                        "error",
                      ),
                    )
                }
              >
                Sync existing records
              </Button>
            </form>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Only SuperAdmin can create additional schools. Your school is the
              family tenant you already belong to.
            </p>
          )}
        </Section>

        {selectedSchool ? (
          <Section title="This school">
            <form
              onSubmit={(e) => void onRenameSchool(e)}
              className="flex flex-wrap items-end gap-2"
            >
              <div className="min-w-[12rem] flex-1">
                <Input
                  label="School name"
                  value={renameDraft ?? selectedSchool.name}
                  onChange={(e) => setRenameDraft(e.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary" size="sm">
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  void backfill({ familyId })
                    .then((r) =>
                      notify(
                        `Synced ${r.families} schools, ${r.contacts} contacts.`,
                      ),
                    )
                    .catch((err) =>
                      notify(
                        err instanceof Error ? err.message : "Failed",
                        "error",
                      ),
                    )
                }
              >
                Sync contacts
              </Button>
            </form>
          </Section>
        ) : null}
      </TabPanel>

      <TabPanel id="parents" active={tab === "parents"}>
        <Section
          title="Parents"
          description="Main parent controls the school. Admin parents can add teachers. Regular parents cannot."
        >
          {locked ? (
            <EmptyState>Create a school first.</EmptyState>
          ) : parents === undefined ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : parents.length === 0 ? (
            <EmptyState>No parents yet.</EmptyState>
          ) : (
            <ul className="space-y-1.5">
              {parents.map((p) => (
                <li key={p.membershipId} className="list-row list-row-dense">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {p.name ?? p.email ?? p.userId}
                      <Badge
                        tone={p.schoolRole === "main" ? "accent" : "neutral"}
                        className="ml-2"
                      >
                        {p.schoolRole}
                      </Badge>
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {p.email}
                      {p.phone ? ` · ${p.phone}` : ""}
                    </p>
                  </div>
                  {canManage && !p.isMain ? (
                    <span className="flex flex-wrap gap-1.5">
                      <Select
                        value={p.schoolRole === "admin" ? "admin" : "regular"}
                        onChange={(e) =>
                          void updateParentRole({
                            familyId: familyId!,
                            userId: p.userId,
                            schoolRole: e.target.value as SchoolRole,
                          })
                            .then(() => notify("Role updated."))
                            .catch((err) =>
                              notify(
                                err instanceof Error ? err.message : "Failed",
                                "error",
                              ),
                            )
                        }
                      >
                        <option value="regular">regular</option>
                        <option value="admin">admin</option>
                      </Select>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          if (!window.confirm("Remove this parent?")) return;
                          void removeParent({
                            familyId: familyId!,
                            userId: p.userId,
                          })
                            .then(() => notify("Parent removed."))
                            .catch((err) =>
                              notify(
                                err instanceof Error ? err.message : "Failed",
                                "error",
                              ),
                            );
                        }}
                      >
                        Remove
                      </Button>
                    </span>
                  ) : (
                    <Badge tone="success">Main</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canManage && familyId ? (
            <form
              onSubmit={(e) => void onAddParent(e)}
              className="mt-4 grid gap-2 sm:grid-cols-2"
            >
              <Input
                label="Name"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
              />
              <Input
                type="email"
                label="Email"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                required
              />
              <Input
                label="Phone"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
              />
              <Select
                label="School role"
                value={parentRole}
                onChange={(e) => setParentRole(e.target.value as SchoolRole)}
              >
                <option value="regular">Regular parent</option>
                <option value="admin">Admin parent</option>
              </Select>
              <div className="sm:col-span-2">
                <Button type="submit" size="sm">
                  Add parent
                </Button>
              </div>
            </form>
          ) : null}
        </Section>
      </TabPanel>

      <TabPanel id="teachers" active={tab === "teachers"}>
        <Section
          title="Teachers & tutors"
          description="Admin parents and SuperAdmin assign which students and courses each teacher can see."
          action={
            canManage && familyId ? (
              <Button size="sm" onClick={() => openTeacher()}>
                Add teacher
              </Button>
            ) : null
          }
        >
          {locked ? (
            <EmptyState>Create a school first.</EmptyState>
          ) : teachers === undefined ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : teachers.length === 0 ? (
            <EmptyState>No teachers assigned yet.</EmptyState>
          ) : (
            <ul className="space-y-1.5">
              {teachers.map((t) => (
                <li key={t.staffId} className="list-row list-row-dense">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {t.name ?? t.email ?? t.userId}
                      <Badge tone="neutral" className="ml-2">
                        {t.memberKind}
                      </Badge>
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {t.email}
                      {` · ${t.studentIds.length} students · ${t.courseIds.length} courses`}
                    </p>
                  </div>
                  {canManage ? (
                    <span className="flex flex-wrap gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openTeacher(t)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          if (!window.confirm("Remove this teacher?")) return;
                          void removeTeacher({
                            familyId: familyId!,
                            userId: t.userId,
                          })
                            .then(() => notify("Teacher removed."))
                            .catch((err) =>
                              notify(
                                err instanceof Error ? err.message : "Failed",
                                "error",
                              ),
                            );
                        }}
                      >
                        Remove
                      </Button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </TabPanel>

      <TabPanel id="students" active={tab === "students"}>
        <Section title="Students" description="Students belong to this school.">
          {locked ? (
            <EmptyState>Create a school first.</EmptyState>
          ) : students === undefined ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : students.length === 0 ? (
            <EmptyState>No students yet.</EmptyState>
          ) : (
            <ul className="space-y-1.5">
              {students.map((s) => (
                <li key={s._id} className="list-row list-row-dense">
                  <div>
                    <p className="font-medium">{s.displayName}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {s.academicLevel ?? "Student"}
                    </p>
                  </div>
                  <span className="flex flex-wrap gap-1.5">
                    <Link href={`/family/students/${s._id}`}>
                      <Button variant="ghost" size="sm">
                        Open
                      </Button>
                    </Link>
                    {caps?.canManageStudents ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditStudentId(s._id);
                            setStudentName(s.displayName);
                            setStudentLevel(s.academicLevel ?? "");
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            if (!window.confirm(`Delete ${s.displayName}?`))
                              return;
                            void removeStudent({ studentId: s._id })
                              .then(() => notify("Student deleted."))
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
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {caps?.canManageStudents && familyId ? (
            <form
              onSubmit={(e) => void onAddStudent(e)}
              className="mt-4 flex flex-wrap items-end gap-2"
            >
              <div className="min-w-[10rem] flex-1">
                <Input
                  label={editStudentId ? "Edit name" : "Display name"}
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  required
                />
              </div>
              <div className="min-w-[8rem] flex-1">
                <Input
                  label="Level"
                  value={studentLevel}
                  onChange={(e) => setStudentLevel(e.target.value)}
                />
              </div>
              <Button type="submit" size="sm">
                {editStudentId ? "Save" : "Add student"}
              </Button>
            </form>
          ) : null}
        </Section>
      </TabPanel>

      <TabPanel id="contacts" active={tab === "contacts"}>
        <Section
          title="Directory"
          description="Every school, parent, teacher, and student has a contact profile."
          action={
            <span className="flex flex-wrap gap-1.5">
              <Link href="/contacts">
                <Button variant="ghost" size="sm">
                  Full directory
                </Button>
              </Link>
              {canManage && familyId ? (
                <Button size="sm" onClick={() => openContact()}>
                  Add contact
                </Button>
              ) : null}
            </span>
          }
        >
          {locked ? (
            <EmptyState>Create a school first.</EmptyState>
          ) : contacts === undefined ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : contacts.length === 0 ? (
            <EmptyState>No contacts yet.</EmptyState>
          ) : (
            <ul className="space-y-1.5">
              {contacts.map((c) => (
                <li key={c._id} className="list-row list-row-dense">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {c.displayName}
                      <Badge tone="neutral" className="ml-2">
                        {c.kind}
                      </Badge>
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {c.emails.join(", ") || "No email"}
                      {c.roleLabel ? ` · ${c.roleLabel}` : ""}
                    </p>
                  </div>
                  <span className="flex flex-wrap gap-1.5">
                    <Link href={`/contacts/${c._id}`}>
                      <Button variant="ghost" size="sm">
                        Open
                      </Button>
                    </Link>
                    {canManage ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openContact(c)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            if (!window.confirm(`Delete ${c.displayName}?`))
                              return;
                            void removeContact({ contactId: c._id })
                              .then(() => notify("Contact deleted."))
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
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </TabPanel>

      <Modal
        open={teacherOpen}
        onClose={() => setTeacherOpen(false)}
        title={editTeacherId ? "Edit teacher" : "Add teacher"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTeacherOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="teacher-form">
              Save
            </Button>
          </>
        }
      >
        <form
          id="teacher-form"
          onSubmit={(e) => void onSaveTeacher(e)}
          className="space-y-4"
        >
          <Input
            label="Name"
            value={teacherName}
            onChange={(e) => setTeacherName(e.target.value)}
          />
          {!editTeacherId ? (
            <Input
              type="email"
              label="Email"
              value={teacherEmail}
              onChange={(e) => setTeacherEmail(e.target.value)}
              required
            />
          ) : null}
          <Input
            label="Phone"
            value={teacherPhone}
            onChange={(e) => setTeacherPhone(e.target.value)}
          />
          <Select
            label="Kind"
            value={teacherKind}
            onChange={(e) => setTeacherKind(e.target.value as StaffKind)}
          >
            <option value="teacher">Teacher</option>
            <option value="tutor">Tutor</option>
          </Select>
          <fieldset>
            <legend className="text-sm font-medium text-[var(--muted)]">
              Students they can see
            </legend>
            <div className="mt-2 max-h-40 space-y-1 overflow-auto">
              {(students ?? []).map((s) => (
                <label key={s._id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--accent)]"
                    checked={teacherStudents.includes(s._id)}
                    onChange={(e) =>
                      setTeacherStudents((prev) =>
                        e.target.checked
                          ? [...prev, s._id]
                          : prev.filter((id) => id !== s._id),
                      )
                    }
                  />
                  {s.displayName}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium text-[var(--muted)]">
              Courses they can see
            </legend>
            <div className="mt-2 max-h-40 space-y-1 overflow-auto">
              {(courses ?? []).map((c) => (
                <label key={c._id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--accent)]"
                    checked={teacherCourses.includes(c._id)}
                    onChange={(e) =>
                      setTeacherCourses((prev) =>
                        e.target.checked
                          ? [...prev, c._id]
                          : prev.filter((id) => id !== c._id),
                      )
                    }
                  />
                  {c.title}
                </label>
              ))}
            </div>
          </fieldset>
          <Textarea
            label="Notes"
            rows={2}
            value={teacherNotes}
            onChange={(e) => setTeacherNotes(e.target.value)}
          />
        </form>
      </Modal>

      <Modal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        title={editContactId ? "Edit contact" : "Add contact"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setContactOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="contact-form">
              Save
            </Button>
          </>
        }
      >
        <form
          id="contact-form"
          onSubmit={(e) => void onSaveContact(e)}
          className="space-y-4"
        >
          <Input
            label="Name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            required
          />
          <Select
            label="Kind"
            value={contactKind}
            onChange={(e) =>
              setContactKind(e.target.value as typeof contactKind)
            }
          >
            <option value="school">School</option>
            <option value="parent">Parent</option>
            <option value="teacher">Teacher</option>
            <option value="tutor">Tutor</option>
            <option value="student">Student</option>
            <option value="user">User</option>
          </Select>
          <Input
            label="Emails (comma-separated)"
            value={contactEmails}
            onChange={(e) => setContactEmails(e.target.value)}
          />
          <Input
            label="Phones (comma-separated)"
            value={contactPhones}
            onChange={(e) => setContactPhones(e.target.value)}
          />
          <Textarea
            label="Notes"
            rows={3}
            value={contactNotes}
            onChange={(e) => setContactNotes(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  );
}
