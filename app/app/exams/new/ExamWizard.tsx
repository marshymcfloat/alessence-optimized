"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Brain,
  Check,
  CheckCircle,
  FileDoc,
  FilePdf,
  FileText,
  GearSix,
  IdentificationCard,
  Info,
  ListChecks,
  NotePencil,
  Plus,
  Question,
  ShieldCheck,
  Sparkle,
  ToggleLeft,
} from "@phosphor-icons/react";
import type { MaterialSummary, SubjectSummary } from "@/features/frontend/contracts";
import { formatBytes } from "@/lib/format";
import styles from "./wizard.module.css";

const questionTypes = [
  { value: "MULTIPLE_CHOICE", label: "Multiple choice", note: "Choose one correct option", icon: ListChecks },
  { value: "TRUE_FALSE", label: "True or false", note: "Fast concept checks", icon: ToggleLeft },
  { value: "IDENTIFICATION", label: "Identification", note: "Recall terms and ideas", icon: IdentificationCard },
] as const;

const itemOptions = [5, 10, 15, 25, 50, 70];
const timeOptions = [null, 30, 60, 90, 120] as const;
const steps = [
  { label: "Sources", note: "Choose what to study", icon: BookOpenText },
  { label: "Settings", note: "Shape the practice", icon: GearSix },
  { label: "Review", note: "Confirm and generate", icon: CheckCircle },
];

export function ExamWizard({
  materials,
  subjects,
}: {
  materials: MaterialSummary[];
  subjects: SubjectSummary[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? 0);
  const [selected, setSelected] = useState<number[]>([]);
  const [description, setDescription] = useState("");
  const [items, setItems] = useState(10);
  const [types, setTypes] = useState<string[]>(["MULTIPLE_CHOICE"]);
  const [timeLimit, setTimeLimit] = useState<number | "">("");
  const [practice, setPractice] = useState(true);
  const [emphasizeWeakTopics, setEmphasizeWeakTopics] = useState(false);
  const [knowledge, setKnowledge] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const available = useMemo(
    () => materials.filter((material) => material.subject?.id === subjectId && material.ingestionStatus === "READY"),
    [materials, subjectId],
  );
  const currentSubject = subjects.find((subject) => subject.id === subjectId);
  const selectedMaterials = materials.filter((material) => selected.includes(material.id));
  const canContinue = step === 1
    ? Boolean(subjectId && (selected.length || knowledge))
    : Boolean(description.trim() && types.length);

  function chooseSubject(id: number) {
    setSubjectId(id);
    setSelected([]);
    setKnowledge(false);
  }

  function toggleSource(id: number) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function toggleType(type: string) {
    setTypes((current) => current.includes(type) ? current.filter((value) => value !== type) : [...current, type]);
  }

  async function create() {
    setPending(true);
    setError("");
    const body = new FormData();
    body.set("description", description);
    body.set("requestedItems", String(items));
    body.set("subjectId", String(subjectId));
    body.set("isPracticeMode", String(practice));
    body.set("emphasizeWeakTopics", String(emphasizeWeakTopics));
    body.set("allowModelKnowledge", String(knowledge));
    if (timeLimit) body.set("timeLimit", String(timeLimit));
    types.forEach((type) => body.append("questionTypes", type));
    selected.forEach((id) => body.append("existingFileIds", String(id)));
    try {
      const response = await fetch("/api/exams", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Could not create exam.");
      router.push("/app/exams");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create exam.");
      setPending(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link href="/app/exams"><ArrowLeft size={15} /> Practice library</Link>
          <h1>Create an exam</h1>
          <p>Start with trustworthy sources, then shape the practice around what matters now.</p>
        </div>
        <span className={styles.privateBadge}><ShieldCheck size={17} weight="duotone" /> Private and source-grounded</span>
      </header>

      <div className={styles.wizardLayout}>
        <aside className={styles.stepRail}>
          <p>Exam setup</p>
          <nav aria-label={`Step ${step} of 3`}>
            {steps.map((item, index) => {
              const number = index + 1;
              const Icon = item.icon;
              return (
                <button type="button" className={`${styles.stepItem} ${step === number ? styles.currentStep : ""} ${step > number ? styles.doneStep : ""}`} onClick={() => step > number && setStep(number)} disabled={step < number} key={item.label}>
                  <span>{step > number ? <Check size={17} weight="bold" /> : <Icon size={19} weight="duotone" />}</span>
                  <span><strong>{item.label}</strong><small>{item.note}</small></span>
                  <b>0{number}</b>
                </button>
              );
            })}
          </nav>
          <div className={styles.guidanceCard}>
            <span><Sparkle size={17} weight="duotone" /></span>
            <div>
              <strong>{step === 1 ? "Why sources first" : step === 2 ? "Keep the brief specific" : "Before you generate"}</strong>
              <p>{step === 1 ? "Selected readings become the evidence behind each question." : step === 2 ? "Name the lesson, coverage, and ideas that deserve more attention." : "Check the source mode, question mix, and timer one last time."}</p>
            </div>
          </div>
        </aside>

        <main className={styles.workspace}>
          <div className={styles.workspaceHead}>
            <div><span>Step {step} of 3</span><h2>{steps[step - 1].label}</h2><p>{steps[step - 1].note}</p></div>
            <span className={styles.stepCount}>0{step}</span>
          </div>

          {step === 1 && (
            <div className={styles.stepContent}>
              <section className={styles.formSection} aria-labelledby="subject-heading">
                <div className={styles.fieldHeading}><span><BookOpenText size={21} weight="duotone" /></span><div><h3 id="subject-heading">Choose a subject</h3><p>The source list updates with your selection.</p></div></div>
                <div className={styles.subjectScroller} role="radiogroup" aria-label="Exam subject">
                  {subjects.map((subject, index) => (
                    <button type="button" role="radio" aria-checked={subject.id === subjectId} className={`${styles.subjectChoice} ${styles[`tone${index % 4}`]} ${subject.id === subjectId ? styles.selectedSubject : ""}`} onClick={() => chooseSubject(subject.id)} key={subject.id}>
                      <span><BookOpenText size={20} weight={subject.id === subjectId ? "fill" : "duotone"} /></span>
                      <strong>{subject.title}</strong>
                      <small>{subject.materialCount} materials</small>
                      {subject.id === subjectId && <Check size={16} weight="bold" />}
                    </button>
                  ))}
                  {!subjects.length && <Link className={styles.addSubjectCard} href="/app/materials"><Plus size={21} /><span><strong>Create a subject</strong><small>Organize your first source</small></span></Link>}
                </div>
              </section>

              <section className={styles.formSection} aria-labelledby="source-heading">
                <div className={styles.fieldHeading}><span><FileText size={21} weight="duotone" /></span><div><h3 id="source-heading">Select source material</h3><p>Choose up to 25 ready files. Every generated question will cite its source.</p></div><b>{selected.length} selected</b></div>
                <div className={styles.sourceGrid}>
                  {available.map((material, index) => {
                    const Icon = material.type === "PDF" ? FilePdf : material.type === "DOCX" ? FileDoc : FileText;
                    const active = selected.includes(material.id);
                    return (
                      <button type="button" className={`${styles.sourceCard} ${active ? styles.selectedSource : ""}`} onClick={() => toggleSource(material.id)} aria-pressed={active} key={material.id}>
                        <span className={`${styles.fileIcon} ${styles[`tone${index % 4}`]}`}><Icon size={23} weight="duotone" /></span>
                        <span><strong>{material.name}</strong><small>{material.type} · {formatBytes(material.size)}</small></span>
                        <span className={styles.checkBox}>{active && <Check size={15} weight="bold" />}</span>
                      </button>
                    );
                  })}
                  {!available.length && <div className={styles.noSources}><FileText size={28} weight="duotone" /><div><strong>No ready material for this subject</strong><span>Upload a reading or explicitly use model knowledge.</span></div><Link href="/app/materials">Add material <ArrowRight size={15} /></Link></div>}
                </div>
              </section>

              <button type="button" role="switch" aria-checked={knowledge} className={`${styles.knowledgeToggle} ${knowledge ? styles.toggleOn : ""}`} onClick={() => setKnowledge((current) => !current)}>
                <span className={styles.toggleTrack}><span /></span>
                <span><strong>Allow model knowledge</strong><small>Use only when source material is unavailable. The finished exam will be labeled clearly.</small></span>
                <Info size={19} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className={styles.stepContent}>
              <section className={styles.formSection}>
                <div className={styles.fieldHeading}><span><NotePencil size={21} weight="duotone" /></span><div><h3>Describe the focus</h3><p>Be specific about topics, coverage, or learning objectives.</p></div><b>{description.length}/2000</b></div>
                <label className={styles.focusField}>
                  <span>Exam focus</span>
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="For example: Obligations and contracts, focusing on sources and effects of obligations" maxLength={2000} autoFocus />
                  <small>Write one or two clear sentences. You can include priority topics.</small>
                </label>
              </section>

              <section className={styles.formSection}>
                <div className={styles.fieldHeading}><span><Question size={21} weight="duotone" /></span><div><h3>Number of questions</h3><p>Choose a length that fits the study session.</p></div></div>
                <div className={styles.countOptions} role="radiogroup" aria-label="Number of questions">
                  {itemOptions.map((value) => <button type="button" role="radio" aria-checked={items === value} className={items === value ? styles.selectedCount : ""} onClick={() => setItems(value)} key={value}><strong>{value}</strong><span>questions</span></button>)}
                </div>
              </section>

              <section className={styles.formSection}>
                <div className={styles.fieldHeading}><span><ListChecks size={21} weight="duotone" /></span><div><h3>Question types</h3><p>Select one or combine several formats.</p></div><b>{types.length} selected</b></div>
                <div className={styles.typeGrid}>
                  {questionTypes.map((type) => {
                    const Icon = type.icon;
                    const active = types.includes(type.value);
                    return <button type="button" className={active ? styles.selectedType : ""} aria-pressed={active} onClick={() => toggleType(type.value)} key={type.value}><span><Icon size={23} weight="duotone" /></span><strong>{type.label}</strong><small>{type.note}</small><b>{active && <Check size={15} weight="bold" />}</b></button>;
                  })}
                </div>
              </section>

              <section className={styles.advancedSection}>
                <button type="button" className={styles.advancedButton} aria-expanded={advanced} onClick={() => setAdvanced((current) => !current)}><span><GearSix size={20} weight="duotone" /><span><strong>Advanced settings</strong><small>Timer, repeat attempts, and weak-topic focus</small></span></span><ArrowRight size={17} className={advanced ? styles.rotated : ""} /></button>
                {advanced && <div className={styles.advancedContent}>
                  <div><span className={styles.controlLabel}>Time limit</span><div className={styles.timeOptions}>{timeOptions.map((value) => <button type="button" className={(value ?? "") === timeLimit ? styles.selectedTime : ""} onClick={() => setTimeLimit(value ?? "")} key={value ?? "none"}>{value ? `${value} min` : "Untimed"}</button>)}</div></div>
                  <button type="button" role="switch" aria-checked={practice} className={`${styles.practiceToggle} ${practice ? styles.toggleOn : ""}`} onClick={() => setPractice((current) => !current)}><span className={styles.toggleTrack}><span /></span><span><strong>Practice mode</strong><small>Allow repeated attempts on this exam.</small></span></button>
                  <button type="button" role="switch" aria-checked={emphasizeWeakTopics} className={`${styles.practiceToggle} ${emphasizeWeakTopics ? styles.toggleOn : ""}`} onClick={() => setEmphasizeWeakTopics((current) => !current)}><span className={styles.toggleTrack}><span /></span><span><strong>Focus on weak topics</strong><small>Use up to 40% of questions for topics missed in earlier attempts.</small></span></button>
                </div>}
              </section>
            </div>
          )}

          {step === 3 && (
            <div className={styles.reviewContent}>
              <section className={styles.examBrief}>
                <span className={styles.briefBadge}><Sparkle size={15} weight="fill" /> Ready to generate</span>
                <p>{currentSubject?.title ?? "Subject"}</p>
                <h2>{description}</h2>
                <div className={styles.briefStats}>
                  <div><strong>{items}</strong><span>Questions</span></div>
                  <div><strong>{selected.length}</strong><span>Sources</span></div>
                  <div><strong>{types.length}</strong><span>Formats</span></div>
                  <div><strong>{timeLimit || "—"}</strong><span>{timeLimit ? "Minutes" : "Untimed"}</span></div>
                </div>
              </section>

              <div className={styles.reviewGrid}>
                <section><div className={styles.reviewHeading}><BookOpenText size={20} weight="duotone" /><div><h3>Grounding</h3><p>{selected.length ? "Selected source material" : "Model knowledge"}</p></div></div>{selectedMaterials.length ? <div className={styles.reviewSources}>{selectedMaterials.map((material) => <span key={material.id}><FileText size={15} />{material.name}</span>)}</div> : <p className={styles.knowledgeNotice}>This exam will use model knowledge and will be labeled accordingly.</p>}</section>
                <section><div className={styles.reviewHeading}><ListChecks size={20} weight="duotone" /><div><h3>Question formats</h3><p>{practice ? "Repeat attempts enabled" : "Single-attempt mode"}{emphasizeWeakTopics ? " · Weak-topic focus enabled" : ""}</p></div></div><div className={styles.reviewTypes}>{types.map((type) => <span key={type}>{questionTypes.find((item) => item.value === type)?.label}</span>)}</div></section>
              </div>
              <div className={styles.generationNote}><Brain size={21} weight="duotone" /><div><strong>Generation continues in the background</strong><span>You can leave the page after starting. Alessence will validate every question before the exam becomes ready.</span></div></div>
              {error && <div className={styles.error} role="alert"><Info size={18} />{error}</div>}
            </div>
          )}

          <footer className={styles.actions}>
            <button className={styles.backButton} type="button" onClick={() => step === 1 ? router.back() : setStep(step - 1)}><ArrowLeft size={17} weight="bold" /> Back</button>
            <div><span>{step < 3 ? `${step} of 3 steps complete` : "Everything looks ready"}</span>{step < 3 ? <button className={styles.nextButton} type="button" disabled={!canContinue} onClick={() => setStep(step + 1)}>Continue <ArrowRight size={17} weight="bold" /></button> : <button className={styles.generateButton} type="button" disabled={pending} onClick={create}>{pending ? "Starting generation…" : "Generate exam"}<ArrowRight size={17} weight="bold" /></button>}</div>
          </footer>
        </main>
      </div>
    </div>
  );
}
