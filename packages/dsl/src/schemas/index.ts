import { z } from "zod";
import {
  SUPPORTED_COMPONENT_TYPES,
  SUPPORTED_FIELD_TYPES,
  SUPPORTED_RELATION_TYPES,
} from "@codalyn/shared";

// Field Types
export const FieldTypeSchema = z.enum(SUPPORTED_FIELD_TYPES as [string, ...string[]]);

// Component Prop Schema
export const ComponentPropSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "function", "object", "array"]),
  required: z.boolean().default(false),
  description: z.string().optional(),
  defaultValue: z.unknown().optional(),
});

// Component State Schema
export const ComponentStateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "object", "array"]),
  initialValue: z.unknown().optional(),
});

// Component Style Schema
export const ComponentStyleSchema = z.object({
  className: z.string().optional(),
  styles: z.record(z.string()).optional(),
  responsive: z
    .object({
      sm: z.string().optional(),
      md: z.string().optional(),
      lg: z.string().optional(),
      xl: z.string().optional(),
    })
    .optional(),
});

// Component Spec Schema
export const ComponentSpecSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.enum(SUPPORTED_COMPONENT_TYPES as [string, ...string[]]),
  props: z.array(ComponentPropSchema).default([]),
  state: z.array(ComponentStateSchema).default([]),
  styles: ComponentStyleSchema.optional(),
  children: z.array(z.string()).optional(), // IDs of child components
  shadcnComponent: z.string().optional(), // e.g., "button", "card"
  description: z.string().optional(),
});

// Entity Field Schema
export const EntityFieldSchema = z.object({
  name: z.string().min(1),
  type: FieldTypeSchema,
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  description: z.string().optional(),
  maxLength: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

// Entity Relation Schema
export const EntityRelationSchema = z.object({
  name: z.string().min(1),
  type: z.enum(SUPPORTED_RELATION_TYPES as [string, ...string[]]),
  targetEntity: z.string().min(1),
  foreignKey: z.string().optional(),
  description: z.string().optional(),
});

// Entity Spec Schema
export const EntitySpecSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  fields: z.array(EntityFieldSchema).min(1),
  relations: z.array(EntityRelationSchema).default([]),
  indexes: z.array(z.string()).default([]),
  description: z.string().optional(),
});

// Route Handler Schema
export const RouteHandlerSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
  handler: z.string(), // Function name or inline code
  auth: z.boolean().default(false),
  validation: z.unknown().optional(), // Zod schema
});

// Route Spec Schema
export const RouteSpecSchema = z.object({
  id: z.string(),
  path: z.string().min(1), // e.g., "/api/users", "/api/users/[id]"
  handlers: z.array(RouteHandlerSchema).min(1),
  description: z.string().optional(),
});

// Page Layout Schema
export const PageLayoutSchema = z.object({
  type: z.enum(["default", "centered", "full-width", "dashboard"]),
  sidebar: z.boolean().default(false),
  header: z.boolean().default(true),
  footer: z.boolean().default(false),
});

// Page Spec Schema
export const PageSpecSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  route: z.string().min(1), // e.g., "/", "/users", "/users/[id]"
  layout: PageLayoutSchema.default({ type: "default", sidebar: false, header: true }),
  components: z.array(z.string()).default([]), // Component IDs
  metadata: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
  description: z.string().optional(),
});

// CRUD Operation Schema
export const CRUDOperationSchema = z.object({
  entityId: z.string(),
  operations: z.array(z.enum(["create", "read", "update", "delete"])).min(1),
  generatePages: z.boolean().default(true),
  generateApiRoutes: z.boolean().default(true),
});

// App Spec Schema (Root)
export const AppSpecSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string().default("1.0.0"),
  entities: z.array(EntitySpecSchema).default([]),
  components: z.array(ComponentSpecSchema).default([]),
  pages: z.array(PageSpecSchema).default([]),
  routes: z.array(RouteSpecSchema).default([]),
  crudOperations: z.array(CRUDOperationSchema).default([]),
  environment: z
    .record(
      z.object({
        type: z.enum(["string", "number", "boolean"]),
        required: z.boolean().default(false),
        defaultValue: z.unknown().optional(),
        description: z.string().optional(),
      })
    )
    .default({}),
  metadata: z
    .object({
      author: z.string().optional(),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
    })
    .optional(),
});

// Type exports
export type ComponentSpec = z.infer<typeof ComponentSpecSchema>;
export type EntitySpec = z.infer<typeof EntitySpecSchema>;
export type PageSpec = z.infer<typeof PageSpecSchema>;
export type RouteSpec = z.infer<typeof RouteSpecSchema>;
export type CRUDOperation = z.infer<typeof CRUDOperationSchema>;
export type AppSpec = z.infer<typeof AppSpecSchema>;
export type FieldType = z.infer<typeof FieldTypeSchema>;
export type ComponentProp = z.infer<typeof ComponentPropSchema>;
export type ComponentState = z.infer<typeof ComponentStateSchema>;
export type EntityField = z.infer<typeof EntityFieldSchema>;
export type EntityRelation = z.infer<typeof EntityRelationSchema>;

