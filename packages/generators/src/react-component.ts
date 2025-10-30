import { ComponentSpec, ComponentProp, ComponentState } from "@codalyn/dsl";
import { pascalCase, camelCase } from "@codalyn/shared";

export function generateReactComponent(spec: ComponentSpec): string {
  const componentName = pascalCase(spec.name);
  const propsInterface = generatePropsInterface(spec.props, componentName);
  const stateHooks = generateStateHooks(spec.state);
  const propsDestructuring = generatePropsDestructuring(spec.props);
  const className = spec.styles?.className || "";

  return `"use client";

import React${spec.state.length > 0 ? ", { useState }" : ""} from "react";
${spec.shadcnComponent ? `import { ${pascalCase(spec.shadcnComponent)} } from "@/components/ui/${spec.shadcnComponent}";` : ""}

${propsInterface}

export function ${componentName}({ ${propsDestructuring} }: ${componentName}Props) {
${stateHooks}
  
  return (
    <div${className ? ` className="${className}"` : ""}>
      {/* ${spec.name} component */}
    </div>
  );
}
`;
}

function generatePropsInterface(props: ComponentProp[], componentName: string): string {
  if (props.length === 0) {
    return `interface ${componentName}Props {}`;
  }

  const propsTypes = props
    .map((prop) => {
      const optional = prop.required ? "" : "?";
      const type = mapPropType(prop.type);
      return `  ${prop.name}${optional}: ${type}${prop.description ? `; // ${prop.description}` : ";"}`;
    })
    .join("\n");

  return `interface ${componentName}Props {\n${propsTypes}\n}`;
}

function generatePropsDestructuring(props: ComponentProp[]): string {
  if (props.length === 0) {
    return "";
  }

  const defaults = props
    .filter((p) => p.defaultValue !== undefined)
    .map((p) => `${p.name} = ${JSON.stringify(p.defaultValue)}`)
    .join(", ");

  const required = props.filter((p) => p.defaultValue === undefined).map((p) => p.name);

  return [...required, ...(defaults ? [defaults] : [])].join(", ");
}

function generateStateHooks(state: ComponentState[]): string {
  if (state.length === 0) {
    return "";
  }

  return state
    .map((s) => {
      const initialValue = s.initialValue !== undefined ? JSON.stringify(s.initialValue) : getDefaultValue(s.type);
      return `  const [${camelCase(s.name)}, set${pascalCase(s.name)}] = useState<${mapStateType(s.type)}>(${initialValue});`;
    })
    .join("\n");
}

function mapPropType(type: string): string {
  switch (type) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "function":
      return "() => void";
    case "object":
      return "Record<string, unknown>";
    case "array":
      return "unknown[]";
    default:
      return "unknown";
  }
}

function mapStateType(type: string): string {
  switch (type) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return "Record<string, unknown>";
    case "array":
      return "unknown[]";
    default:
      return "unknown";
  }
}

function getDefaultValue(type: string): string {
  switch (type) {
    case "string":
      return '""';
    case "number":
      return "0";
    case "boolean":
      return "false";
    case "object":
      return "{}";
    case "array":
      return "[]";
    default:
      return "null";
  }
}

