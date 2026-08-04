"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function ExamsPageMotion({ className, children }: { className: string; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from("[data-exam-section]", {
        autoAlpha: 0,
        y: 18,
        duration: 0.55,
        stagger: 0.08,
        ease: "power3.out",
        clearProps: "transform,opacity,visibility",
      });
    });
    return () => media.revert();
  }, { scope: rootRef });

  return <div className={className} ref={rootRef}>{children}</div>;
}

export function ExamsReveal({ className, children }: { className?: string; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(rootRef.current, { autoAlpha: 0, y: 10, duration: .38, ease: "power2.out", clearProps: "transform,opacity,visibility" });
    });
    return () => media.revert();
  }, { scope: rootRef });
  return <div className={className} ref={rootRef}>{children}</div>;
}
