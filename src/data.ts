import type { TagOption, TagRecommendations } from "./lib/tags";

// Sample data. Replace freely; it only exists so the picker has something to show.

const group = (name: string, labels: string[]): TagOption[] =>
  labels.map((label) => ({ value: label, label, group: name }));

/** Always shown under the box, browsable by group. */
export const SKILLS: TagOption[] = [
  ...group("Design", [
    "Adobe Illustrator", "Design systems", "Figma", "Framer", "Illustration",
    "Interaction design", "Photoshop", "Prototyping", "Sketch", "UI design",
    "Webflow", "Wireframing",
  ]),
  ...group("Engineering", [
    "Angular", "CSS", "GraphQL", "HTML", "JavaScript", "Next.js", "Node.js",
    "Python", "React", "React Native", "Storybook", "Svelte", "Swift",
    "Tailwind CSS", "TypeScript", "Vue",
  ]),
  ...group("Motion & 3D", ["After Effects", "Animation", "Blender", "Motion design"]),
  ...group("Research & writing", ["Accessibility", "User research", "UX writing"]),
];

/** Only found by typing. `keywords` are hidden search words. */
export const MORE_SKILLS: TagOption[] = [
  { value: "Usability testing", label: "Usability testing", keywords: ["user testing", "ux"], group: "Research & writing" },
  { value: "Information architecture", label: "Information architecture", keywords: ["ia", "sitemap"], group: "Design" },
  { value: "Design tokens", label: "Design tokens", keywords: ["theme", "variables"], group: "Design" },
  { value: "Micro-interactions", label: "Micro-interactions", keywords: ["motion", "hover"], group: "Motion & 3D" },
  { value: "Dark mode", label: "Dark mode", keywords: ["theme"], group: "Design" },
  { value: "Mobile app design", label: "Mobile app design", keywords: ["ios", "android"], group: "Design" },
  { value: "Landing pages", label: "Landing pages", keywords: ["marketing", "website"], group: "Design" },
  { value: "Figma setup", label: "Figma setup", keywords: ["install", "plugins"], group: "Design" },
  { value: "Jetpack Compose", label: "Jetpack Compose", keywords: ["android"], group: "Engineering" },
  { value: "SwiftUI", label: "SwiftUI", keywords: ["ios", "apple"], group: "Engineering" },
  { value: "Three.js", label: "Three.js", keywords: ["3d", "webgl"], group: "Motion & 3D" },
  { value: "Lottie", label: "Lottie", keywords: ["animation"], group: "Motion & 3D" },
];

const rel = (pairs: Array<[string, number]>) => pairs.map(([tag, n]) => ({ tag, n }));

/** "People who use X also use..." counts, keyed by lowercase tag. */
export const RECOMMENDATIONS: TagRecommendations = {
  popular: ["Figma", "React", "TypeScript", "CSS", "UI design", "Prototyping", "Tailwind CSS", "JavaScript"],
  related: {
    "figma": rel([["Prototyping", 40], ["UI design", 38], ["Design systems", 30], ["Wireframing", 22], ["Framer", 12]]),
    "react": rel([["TypeScript", 50], ["Next.js", 35], ["Tailwind CSS", 30], ["Storybook", 14], ["React Native", 10]]),
    "typescript": rel([["React", 50], ["Node.js", 26], ["Next.js", 24], ["GraphQL", 10]]),
    "ui design": rel([["Figma", 38], ["Design systems", 25], ["Interaction design", 18], ["Accessibility", 12]]),
    "prototyping": rel([["Figma", 40], ["Framer", 16], ["User research", 14], ["Interaction design", 12]]),
    "design systems": rel([["Storybook", 20], ["Figma", 30], ["Accessibility", 15], ["Tailwind CSS", 10]]),
    "tailwind css": rel([["React", 30], ["Next.js", 22], ["CSS", 18]]),
    "css": rel([["HTML", 45], ["JavaScript", 40], ["Animation", 12], ["Accessibility", 10]]),
    "user research": rel([["Wireframing", 20], ["UX writing", 12], ["Prototyping", 14]]),
    "motion design": rel([["After Effects", 30], ["Animation", 25], ["Framer", 10]]),
  },
};
