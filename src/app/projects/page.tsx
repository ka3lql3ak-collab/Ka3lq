"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { ProjectLibrary } from "@/components/ProjectLibrary";

function Inner() {
  const pick = useSearchParams().get("pick");
  const allowed = ["story", "storyboard", "scenes", "editor"];
  const p = pick && allowed.includes(pick) ? pick : null;
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow="Projects" title={p ? "Choose a project" : "Project library"} subtitle={p ? `Pick the project to open in the ${p} workspace.` : "All of your fruit stories."} />
      <ProjectLibrary pick={p} />
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
