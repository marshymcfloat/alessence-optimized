"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive, ArrowRight, CaretDown, Check, CheckCircle, FileDoc, FilePdf,
  Files, FileText, Folder, FolderSimplePlus, MagnifyingGlass, PencilSimple,
  Plus, Trash, X,
} from "@phosphor-icons/react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { MaterialSummary, SubjectSummary } from "@/features/frontend/contracts";
import { formatBytes, formatDate } from "@/lib/format";
import styles from "./materials.module.css";

gsap.registerPlugin(useGSAP);
type SelectOption = { value: string; label: string };

function CustomSelect({ label, value, options, onChange }: { label: string; value: string; options: SelectOption[]; onChange: (value: string) => void }) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  useEffect(() => {
    function close(event: MouseEvent) { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useGSAP(() => {
    if (!open || !menuRef.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.from(menuRef.current, { autoAlpha: 0, y: -6, scale: .98, duration: .2, ease: "power2.out", clearProps: "transform,opacity,visibility" });
  }, { scope: rootRef, dependencies: [open], revertOnUpdate: true });
  return <div className={styles.customSelect} ref={rootRef}><span className={styles.controlLabel} id={`${id}-label`}>{label}</span><button type="button" className={`${styles.selectButton} ${open ? styles.controlOpen : ""}`} aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span id={`${id}-value`}>{selected?.label ?? "Choose a subject"}</span><CaretDown size={17} weight="bold" /></button>{open && <div className={styles.selectMenu} role="listbox" aria-labelledby={`${id}-label`} ref={menuRef}>{options.map((option) => <button type="button" role="option" aria-selected={option.value === value} className={option.value === value ? styles.selectedOption : ""} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }}><span>{option.label}</span>{option.value === value && <Check size={16} weight="bold" />}</button>)}</div>}</div>;
}

export function UploadIsland({ subjects }: { subjects: SubjectSummary[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadSubject, setUploadSubject] = useState<number | "">(subjects[0]?.id ?? "");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const options = subjects.map((subject) => ({ value: String(subject.id), label: subject.title }));
  async function upload() {
    if (!selectedFiles.length || !uploadSubject) return;
    setPending(true); setMessage("");
    const body = new FormData(); body.set("subjectId", String(uploadSubject)); selectedFiles.forEach((file) => body.append("files", file));
    try {
      const response = await fetch("/api/materials", { method: "POST", body });
      const contentType = response.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : { error: { message: response.ok ? "The server returned an invalid response." : `Upload failed (${response.status}). Check the server log.` } };
      if (!response.ok) throw new Error(data.error?.message ?? "Upload failed.");
      if (fileRef.current) fileRef.current.value = "";
      setSelectedFiles([]); setMessage("Upload complete. Indexing continues in the background."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); }
    finally { setPending(false); }
  }
  return <div className={styles.islandContent}><CustomSelect label="Save to subject" value={String(uploadSubject)} options={options} onChange={(value) => setUploadSubject(Number(value))} /><div className={styles.fileField}><span className={styles.controlLabel}>Choose files</span><input ref={fileRef} className={styles.hiddenFile} id="material-files" type="file" multiple accept=".pdf,.docx,.txt" onChange={(event) => setSelectedFiles(event.target.files ? Array.from(event.target.files) : [])} /><label className={styles.dropzone} htmlFor="material-files"><span className={styles.dropIcon}><Files size={29} weight="duotone" /></span><span><strong>{selectedFiles.length ? `${selectedFiles.length} ${selectedFiles.length === 1 ? "file" : "files"} selected` : "Choose readings to upload"}</strong><small>{selectedFiles.length ? selectedFiles.map((file) => file.name).join(", ") : "Browse from this device"}</small></span><span className={styles.browseButton}>Browse</span></label></div><button className={styles.uploadButton} disabled={pending || !uploadSubject || !selectedFiles.length} onClick={upload}>{pending ? "Uploading…" : "Upload and index"}<ArrowRight size={18} weight="bold" /></button>{message && <div className={`${styles.message} ${/failed|could not|cannot/i.test(message) ? styles.messageError : ""}`} role="status"><CheckCircle size={18} weight="fill" />{message}</div>}</div>;
}

export function SubjectIsland({ subjects: incoming }: { subjects: SubjectSummary[] }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [subjects, setSubjects] = useState(incoming);
  const [newSubject, setNewSubject] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [archiving, setArchiving] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  useGSAP(() => { if (!matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.from(`.${styles.subjectRow}`, { autoAlpha: 0, x: 8, stagger: .035, duration: .25, ease: "power2.out", clearProps: "transform,opacity,visibility" }); }, { scope: rootRef, dependencies: [incoming] });
  useGSAP(() => { if (archiving && !matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.from(`.${styles.inlineConfirm}`, { autoAlpha: 0, x: 7, scale: .98, duration: .2, ease: "power2.out", clearProps: "transform,opacity,visibility" }); }, { scope: rootRef, dependencies: [archiving], revertOnUpdate: true });
  async function add(event: React.FormEvent) { event.preventDefault(); const title = newSubject.trim(); if (!title) return; const response = await fetch("/api/subjects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) }); const data = await response.json(); if (!response.ok) return setMessage(data.error?.message ?? "Could not add subject."); setSubjects((current) => [...current, { ...data.subject, materialCount: 0, examCount: 0 }].sort((a, b) => a.title.localeCompare(b.title))); setNewSubject(""); setMessage("Subject added."); router.refresh(); }
  async function rename(subject: SubjectSummary) { const title = editTitle.trim(); if (!title || title === subject.title) return setEditing(null); const response = await fetch(`/api/subjects/${subject.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) }); const data = await response.json(); if (!response.ok) return setMessage(data.error?.message ?? "Could not rename subject."); setSubjects((current) => current.map((item) => item.id === subject.id ? { ...item, title: data.subject.title } : item).sort((a, b) => a.title.localeCompare(b.title))); setEditing(null); router.refresh(); }
  async function archive(subject: SubjectSummary) { const response = await fetch(`/api/subjects/${subject.id}`, { method: "DELETE" }); if (!response.ok) { const data = await response.json(); return setMessage(data.error?.message ?? "Could not archive subject."); } const row = rootRef.current?.querySelector(`[data-subject-id="${subject.id}"]`); if (row && !matchMedia("(prefers-reduced-motion: reduce)").matches) await gsap.to(row, { autoAlpha: 0, x: 12, duration: .2 }).then(); setSubjects((current) => current.filter((item) => item.id !== subject.id)); setArchiving(null); router.refresh(); }
  return <div ref={rootRef}><form className={styles.addSubject} onSubmit={add}><label className={styles.srOnly} htmlFor="new-subject">New subject name</label><span><Folder size={18} weight="duotone" /></span><input id="new-subject" value={newSubject} onChange={(event) => setNewSubject(event.target.value)} placeholder="New subject name" minLength={2} maxLength={80} required /><button type="submit" aria-label="Add subject" disabled={newSubject.trim().length < 2}><Plus size={20} weight="bold" /></button></form><div className={styles.subjectList}>{subjects.map((subject, index) => <div className={styles.subjectRow} data-subject-id={subject.id} key={subject.id}><span className={`${styles.subjectFolder} ${styles[`tone${index % 4}`]}`}><Folder size={20} weight="fill" /></span>{editing === subject.id ? <div className={styles.inlineEdit}><input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} aria-label={`New name for ${subject.title}`} autoFocus /><button type="button" onClick={() => rename(subject)} aria-label="Save name"><Check size={17} weight="bold" /></button><button type="button" onClick={() => setEditing(null)} aria-label="Cancel rename"><X size={17} /></button></div> : archiving === subject.id ? <div className={styles.inlineConfirm}><span><strong>Archive this subject?</strong><small>Existing exams remain available.</small></span><button type="button" onClick={() => archive(subject)}>Archive</button><button type="button" onClick={() => setArchiving(null)}>Cancel</button></div> : <><span className={styles.subjectCopy}><strong>{subject.title}</strong><small>{subject.materialCount} materials · {subject.examCount} exams</small></span><button className={styles.rowAction} type="button" aria-label={`Rename ${subject.title}`} onClick={() => { setEditing(subject.id); setEditTitle(subject.title); setArchiving(null); }}><PencilSimple size={17} /></button><button className={styles.rowAction} type="button" aria-label={`Archive ${subject.title}`} onClick={() => { setArchiving(subject.id); setEditing(null); }}><Archive size={17} /></button></>}</div>)}{!subjects.length && <div className={styles.emptySubjects}><FolderSimplePlus size={25} /><span>Create a subject before uploading material.</span></div>}</div>{message && <div className={`${styles.message} ${/failed|could not/i.test(message) ? styles.messageError : ""}`} role="status">{message}</div>}</div>;
}

export function LibraryIsland({ materials: incoming, subjects }: { materials: MaterialSummary[]; subjects: SubjectSummary[] }) {
  const router = useRouter(); const rootRef = useRef<HTMLDivElement>(null);
  const [materials, setMaterials] = useState(incoming); const [subjectId, setSubjectId] = useState<number | "all">("all"); const [query, setQuery] = useState(""); const [deleting, setDeleting] = useState<number | null>(null); const [message, setMessage] = useState("");
  const filtered = useMemo(() => { const value = query.trim().toLowerCase(); return materials.filter((material) => (subjectId === "all" || material.subject?.id === subjectId) && (!value || `${material.name} ${material.subject?.title ?? ""}`.toLowerCase().includes(value))); }, [materials, query, subjectId]);
  const options = [{ value: "all", label: "All subjects" }, ...subjects.map((subject) => ({ value: String(subject.id), label: subject.title }))];
  useEffect(() => {
    if (!incoming.some((material) => material.ingestionStatus === "PROCESSING")) return;
    const timer = window.setInterval(() => router.refresh(), 5_000);
    return () => window.clearInterval(timer);
  }, [incoming, router]);
  useGSAP(() => { if (!matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.from(`.${styles.materialCard}`, { autoAlpha: 0, y: 10, stagger: .035, duration: .3, ease: "power2.out", clearProps: "transform,opacity,visibility" }); }, { scope: rootRef, dependencies: [incoming] });
  useGSAP(() => { if (deleting && !matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.from(`.${styles.deleteConfirm}`, { autoAlpha: 0, y: 5, scale: .98, duration: .2, ease: "back.out(1.4)", clearProps: "transform,opacity,visibility" }); }, { scope: rootRef, dependencies: [deleting], revertOnUpdate: true });
  async function remove(id: number) { const response = await fetch(`/api/materials/${id}`, { method: "DELETE" }); if (!response.ok) { const data = await response.json(); return setMessage(data.error?.message ?? "Could not delete material."); } const card = rootRef.current?.querySelector(`[data-material-id="${id}"]`); if (card && !matchMedia("(prefers-reduced-motion: reduce)").matches) await gsap.to(card, { autoAlpha: 0, y: 8, scale: .98, duration: .22 }).then(); setMaterials((current) => current.filter((item) => item.id !== id)); setDeleting(null); router.refresh(); }
  return <div ref={rootRef}><div className={styles.libraryDynamicHead}><span>{filtered.length} {filtered.length === 1 ? "material" : "materials"} shown</span><div className={styles.libraryControls}><label className={styles.searchBox}><span className={styles.srOnly}>Search materials</span><MagnifyingGlass size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search materials" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button>}</label><CustomSelect label="Filter by subject" value={String(subjectId)} options={options} onChange={(value) => setSubjectId(value === "all" ? "all" : Number(value))} /></div></div><div className={styles.materialGrid}>{filtered.map((material, index) => { const Icon = material.type === "PDF" ? FilePdf : material.type === "DOCX" ? FileDoc : FileText; return <article className={styles.materialCard} data-material-id={material.id} key={material.id}><div className={styles.materialTop}><span className={`${styles.materialIcon} ${styles[`tone${index % 4}`]}`}><Icon size={26} weight="duotone" /></span><span className={`${styles.status} ${material.ingestionStatus === "READY" ? styles.statusReady : material.ingestionStatus === "FAILED" ? styles.statusFailed : ""}`}>{material.ingestionStatus.toLowerCase()}</span></div><div className={styles.materialInfo}><h3>{material.name}</h3><p>{material.subject?.title ?? "No subject"}</p>{material.ingestionError && <span className={styles.materialError} role="status">{material.ingestionError}</span>}</div><div className={styles.materialMeta}><span>{formatBytes(material.size)}</span><span>{formatDate(material.createdAt)}</span><span>{material.type}</span></div>{deleting === material.id ? <div className={styles.deleteConfirm}><span>Delete permanently?</span><button type="button" onClick={() => remove(material.id)}>Delete</button><button type="button" onClick={() => setDeleting(null)}>Cancel</button></div> : <button className={styles.deleteButton} type="button" onClick={() => setDeleting(material.id)}><Trash size={16} /> Delete</button>}</article>; })}{!filtered.length && <div className={styles.emptyLibrary}><span><FileText size={32} weight="duotone" /></span><h3>{materials.length ? "No matching materials" : "Your library is ready for its first reading"}</h3><p>{materials.length ? "Try another search or subject filter." : "Upload a PDF, DOCX, or text file to begin."}</p>{materials.length ? <button type="button" onClick={() => { setQuery(""); setSubjectId("all"); }}>Clear filters</button> : <label htmlFor="material-files">Choose a file</label>}</div>}</div>{message && <div className={`${styles.message} ${styles.messageError}`} role="status">{message}</div>}</div>;
}
