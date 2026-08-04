import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { FolderSimplePlus, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { MaterialLibrary, MaterialsHeaderStats, SubjectManager, UploadControls } from "./MaterialsDynamic";
import { HeaderStatsSkeleton, LibrarySkeleton, SubjectsSkeleton, UploadSkeleton } from "./MaterialsSkeletons";
import { MaterialsPageMotion } from "./MaterialsMotion";
import styles from "./materials.module.css";

export const metadata: Metadata = { title: "Materials" };

export default function MaterialsPage() {
  return (
    <MaterialsPageMotion className={styles.page}>
      <header className={styles.header} data-materials-section>
        <div><p>Source library</p><h1>Materials</h1><span>Keep every generated question grounded in readings you trust.</span></div>
        <Suspense fallback={<HeaderStatsSkeleton />}><MaterialsHeaderStats /></Suspense>
      </header>

      <div className={styles.setupGrid} data-materials-section>
        <section className={styles.uploadCard} aria-labelledby="upload-title">
          <Image className={styles.mascotPerch} src="/mascots/materials-leaning-mascot-v2.png" alt="Alessence companion leaning over the upload card with a folder" width={1536} height={1024} priority sizes="(max-width: 680px) 84vw, 368px" />
          <div className={styles.cardHeading}><span className={styles.uploadHeadingIcon}><UploadSimple size={22} weight="duotone" /></span><div><h2 id="upload-title">Add material</h2><p>PDF, DOCX, or TXT · up to 10 MB each</p></div></div>
          <Suspense fallback={<UploadSkeleton />}><UploadControls /></Suspense>
        </section>

        <section className={styles.subjectCard} aria-labelledby="subjects-title">
          <div className={styles.cardHeading}><span className={styles.subjectHeadingIcon}><FolderSimplePlus size={22} weight="duotone" /></span><div><h2 id="subjects-title">Subjects</h2><p>Organize materials and exams into folders</p></div></div>
          <Suspense fallback={<SubjectsSkeleton />}><SubjectManager /></Suspense>
        </section>
      </div>

      <section className={styles.library} aria-labelledby="library-title" data-materials-section>
        <div className={styles.libraryTitle}><p>Your collection</p><h2 id="library-title">Library</h2></div>
        <Suspense fallback={<LibrarySkeleton />}><MaterialLibrary /></Suspense>
      </section>
    </MaterialsPageMotion>
  );
}
