import { Laptop, Layout, Rocket, Shield } from "lucide-react";

export const DOC_GROUPS = [
  {
    name: "General",
    links: [
      {
        title: "Introduction",
        description: "Overview of Tijori's features.",
        to: "/docs",
        icon: Layout,
      },
      {
        title: "Local Setup",
        description: "Set up Tijori locally.",
        to: "/docs/local-setup",
        icon: Laptop,
      },
    ],
  },
  {
    name: "Security",
    links: [
      {
        title: "Architecture",
        description: "Zero-knowledge and threat model.",
        to: "/docs/security",
        icon: Shield,
      },
    ],
  },
  {
    name: "Operations",
    links: [
      {
        title: "Deployment",
        description: "Clerk, Convex, and production.",
        to: "/docs/deployment",
        icon: Rocket,
      },
    ],
  },
];
