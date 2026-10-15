"use client";
import { createContext, useContext } from "react";
import type { StorySettingsValue } from "./StorySettingsForm";

export interface CharacterView {
  id: string;
  name: string;
  fruit: string;
  appearance: string;
  personality: string;
  bodyShape: string;
  face: string;
  eyes: string;
  mouth: string;
  limbs: string;
  clothing: string;
  accessories: string;
  palette: string[];
  voice: { engine: "flite" | "piper" | "recorded"; voice: string; pitch: number; speed: number; volume: number };
  approvedImageId: string | null;
  approvedImageUrl: string | null;
}

export interface ProjectData {
  project: {
    id: string;
    title: string;
    idea: string;
    status: string;
    settings: StorySettingsValue;
    story: { title: string; logline: string; hook: string; description: string; characters: { name: string; fruit: string }[] } | null;
    content: {
      hooks: string[];
      titles: string[];
      description: string;
      hashtags: string[];
      pinnedComment: string;
      coverSuggestions: { sceneIndex: number; reason: string; atSec: number }[];
    } | null;
    scriptApproved: boolean;
    budgetUsd: number | null;
  };
  summary: { stage: string; spent: number; sceneCount: number; clipCount: number; storyboardCount: number; approvedScenes: number };
  characters: CharacterView[];
}

export const ProjectCtx = createContext<{ data: ProjectData | undefined; reload: () => Promise<void> }>({ data: undefined, reload: async () => {} });
export const useProject = () => useContext(ProjectCtx);
