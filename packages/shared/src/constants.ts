export const DSL_VERSION = "1.0.0";

export const SUPPORTED_COMPONENT_TYPES = [
  "button",
  "input",
  "form",
  "card",
  "modal",
  "table",
  "list",
  "nav",
  "header",
  "footer",
] as const;

export const SUPPORTED_FIELD_TYPES = [
  "string",
  "number",
  "boolean",
  "date",
  "email",
  "url",
  "text",
  "json",
] as const;

export const SUPPORTED_RELATION_TYPES = [
  "oneToOne",
  "oneToMany",
  "manyToMany",
] as const;

export const DEFAULT_TAILWIND_CONFIG = {
  theme: {
    extend: {},
  },
  plugins: [],
};

