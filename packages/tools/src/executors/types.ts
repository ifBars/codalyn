import { SandboxInterface } from "@codalyn/sandbox";

export interface ToolExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
}

export interface ToolExecutor {
  execute(params: any, sandbox: SandboxInterface): Promise<ToolExecutionResult>;
}

