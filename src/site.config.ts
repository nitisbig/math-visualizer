// Site-wide settings. Swap the name and URLs once the branding is final.
export const SITE = {
  name: "Math, Visually",
  tagline: "Play with the ideas from the videos.",
  description:
    "Interactive visualizations of math, AI, physics and engineering concepts — companion to the YouTube channel.",
  youtube: "https://www.youtube.com/",
};

export const CATEGORIES = ["Math", "AI", "Physics", "Engineering"] as const;
export type Category = (typeof CATEGORIES)[number];
