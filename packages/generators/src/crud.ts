import { EntitySpec, CRUDOperation } from "@codalyn/dsl";
import { pascalCase, camelCase, kebabCase } from "@codalyn/shared";

export function generateCRUDPages(
  entity: EntitySpec,
  operations: CRUDOperation
): Record<string, string> {
  const files: Record<string, string> = {};

  if (operations.generatePages) {
    if (operations.operations.includes("read")) {
      files[`app/${kebabCase(entity.name)}/page.tsx`] = generateListPage(entity);
      files[`app/${kebabCase(entity.name)}/[id]/page.tsx`] = generateDetailPage(entity);
    }
    if (operations.operations.includes("create")) {
      files[`app/${kebabCase(entity.name)}/new/page.tsx`] = generateCreatePage(entity);
    }
    if (operations.operations.includes("update")) {
      files[`app/${kebabCase(entity.name)}/[id]/edit/page.tsx`] = generateEditPage(entity);
    }
  }

  if (operations.generateApiRoutes) {
    if (operations.operations.includes("create")) {
      files[`app/api/${kebabCase(entity.name)}/route.ts`] = generateCreateRoute(entity);
    }
    if (operations.operations.includes("read")) {
      files[`app/api/${kebabCase(entity.name)}/route.ts`] = generateListRoute(entity);
      files[`app/api/${kebabCase(entity.name)}/[id]/route.ts`] = generateGetRoute(entity);
    }
    if (operations.operations.includes("update")) {
      files[`app/api/${kebabCase(entity.name)}/[id]/route.ts`] = generateUpdateRoute(entity);
    }
    if (operations.operations.includes("delete")) {
      files[`app/api/${kebabCase(entity.name)}/[id]/route.ts`] = generateDeleteRoute(entity);
    }
  }

  return files;
}

function generateListPage(entity: EntitySpec): string {
  const entityName = pascalCase(entity.name);
  const entityNamePlural = entityName + "s";

  return `import { ${entityNamePlural}List } from "@/components/${kebabCase(entity.name)}/${entityNamePlural}List";

export default function ${entityNamePlural}Page() {
  return <${entityNamePlural}List />;
}
`;
}

function generateDetailPage(entity: EntitySpec): string {
  const entityName = pascalCase(entity.name);

  return `import { ${entityName}Detail } from "@/components/${kebabCase(entity.name)}/${entityName}Detail";

export default function ${entityName}DetailPage({ params }: { params: { id: string } }) {
  return <${entityName}Detail id={params.id} />;
}
`;
}

function generateCreatePage(entity: EntitySpec): string {
  const entityName = pascalCase(entity.name);
  const formName = entityName + "Form";

  return `import { ${formName} } from "@/components/${kebabCase(entity.name)}/${formName}";

export default function Create${entityName}Page() {
  return <${formName} />;
}
`;
}

function generateEditPage(entity: EntitySpec): string {
  const entityName = pascalCase(entity.name);
  const formName = entityName + "Form";

  return `import { ${formName} } from "@/components/${kebabCase(entity.name)}/${formName}";

export default function Edit${entityName}Page({ params }: { params: { id: string } }) {
  return <${formName} id={params.id} />;
}
`;
}

function generateListRoute(entity: EntitySpec): string {
  const entityName = pascalCase(entity.name);
  const entityNamePlural = entityName + "s";

  return `import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ${camelCase(entity.name)}Table } from "@/lib/db/schema";

export async function GET() {
  try {
    const ${camelCase(entityNamePlural)} = await db.select().from(${camelCase(entity.name)}Table);
    return NextResponse.json(${camelCase(entityNamePlural)});
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch ${entityNamePlural}" }, { status: 500 });
  }
}
`;
}

function generateGetRoute(entity: EntitySpec): string {
  const entityName = pascalCase(entity.name);

  return `import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ${camelCase(entity.name)}Table } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const ${camelCase(entity.name)} = await db.select().from(${camelCase(entity.name)}Table).where(eq(${camelCase(entity.name)}Table.id, params.id)).limit(1);
    
    if (!${camelCase(entity.name)}[0]) {
      return NextResponse.json({ error: "${entityName} not found" }, { status: 404 });
    }
    
    return NextResponse.json(${camelCase(entity.name)}[0]);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch ${entityName}" }, { status: 500 });
  }
}
`;
}

function generateCreateRoute(entity: EntitySpec): string {
  const entityName = pascalCase(entity.name);

  return `import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ${camelCase(entity.name)}Table } from "@/lib/db/schema";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ${camelCase(entity.name)} = await db.insert(${camelCase(entity.name)}Table).values(body).returning();
    return NextResponse.json(${camelCase(entity.name)}[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create ${entityName}" }, { status: 500 });
  }
}
`;
}

function generateUpdateRoute(entity: EntitySpec): string {
  const entityName = pascalCase(entity.name);

  return `import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ${camelCase(entity.name)}Table } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const ${camelCase(entity.name)} = await db.update(${camelCase(entity.name)}Table).set(body).where(eq(${camelCase(entity.name)}Table.id, params.id)).returning();
    
    if (!${camelCase(entity.name)}[0]) {
      return NextResponse.json({ error: "${entityName} not found" }, { status: 404 });
    }
    
    return NextResponse.json(${camelCase(entity.name)}[0]);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update ${entityName}" }, { status: 500 });
  }
}
`;
}

function generateDeleteRoute(entity: EntitySpec): string {
  const entityName = pascalCase(entity.name);

  return `import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ${camelCase(entity.name)}Table } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await db.delete(${camelCase(entity.name)}Table).where(eq(${camelCase(entity.name)}Table.id, params.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete ${entityName}" }, { status: 500 });
  }
}
`;
}

