import { PageSpec } from "@codalyn/dsl";
import { kebabCase, pascalCase } from "@codalyn/shared";

export function generateNextPage(spec: PageSpec, components: string[]): string {
  const pageName = pascalCase(spec.name);
  const routePath = spec.route;
  const isDynamic = routePath.includes("[");
  const metadata = spec.metadata || {};

  return `import { Metadata } from "next";
${components.map((c) => `import { ${c} } from "@/components/${c}";`).join("\n")}

export const metadata: Metadata = {
  title: "${metadata.title || pageName}",
  description: "${metadata.description || ""}",
};

${isDynamic ? generateDynamicParams() : ""}

export default function ${pageName}Page(${isDynamic ? "params: { " + extractDynamicParams(routePath).join(", ") + ": string }" : ""}) {
  return (
    <div>
      {/* ${spec.name} page */}
      ${components.map((c) => `<${c} />`).join("\n      ")}
    </div>
  );
}
`;
}

function generateDynamicParams(): string {
  return `
export async function generateStaticParams() {
  // TODO: Implement static params generation
  return [];
}
`;
}

function extractDynamicParams(route: string): string[] {
  const matches = route.match(/\[(\w+)\]/g);
  return matches ? matches.map((m) => m.slice(1, -1)) : [];
}

export function generatePageLayout(spec: PageSpec): string {
  const layoutName = pascalCase(spec.name) + "Layout";
  const layout = spec.layout;

  return `import { ReactNode } from "react";

interface ${layoutName}Props {
  children: ReactNode;
}

export function ${layoutName}({ children }: ${layoutName}Props) {
  return (
    <div className="${layout.type === "centered" ? "container mx-auto" : layout.type === "dashboard" ? "flex" : ""}">
      ${layout.header ? '<header>{/* Header */}</header>' : ""}
      ${layout.sidebar ? '<aside>{/* Sidebar */}</aside>' : ""}
      <main>{children}</main>
      ${layout.footer ? '<footer>{/* Footer */}</footer>' : ""}
    </div>
  );
}
`;
}

