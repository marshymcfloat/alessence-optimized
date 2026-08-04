"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function DashboardMotion({ className, children }: { className: string; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from("[data-dashboard-section]", {
        autoAlpha: 0, y: 16, duration: 0.52, stagger: 0.07,
        ease: "power3.out", clearProps: "transform,opacity,visibility",
      });
    });
    return () => media.revert();
  }, { scope: rootRef });
  return <div className={className} ref={rootRef}>{children}</div>;
}

export function DashboardReveal({ className, children }: { className?: string; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(rootRef.current, {
        autoAlpha: 0, y: 8, duration: 0.34,
        ease: "power2.out", clearProps: "transform,opacity,visibility",
      });
    });
    return () => media.revert();
  }, { scope: rootRef });
  return <div className={className} ref={rootRef}>{children}</div>;
}
