import Docker from "dockerode";

let dockerInstance: Docker | null = null;

export function getDockerClient(): Docker {
  if (!dockerInstance) {
    dockerInstance = new Docker({
      socketPath: process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock",
    });
  }
  return dockerInstance;
}

export interface ContainerConfig {
  image: string;
  cmd: string[];
  env?: Record<string, string>;
  volumes?: Array<{ hostPath: string; containerPath: string }>;
  workingDir?: string;
}

export async function createContainer(config: ContainerConfig): Promise<Docker.Container> {
  const docker = getDockerClient();

  const container = await docker.createContainer({
    Image: config.image,
    Cmd: config.cmd,
    Env: Object.entries(config.env || {}).map(([key, value]) => `${key}=${value}`),
    WorkingDir: config.workingDir || "/app",
    HostConfig: {
      Binds: config.volumes?.map((v) => `${v.hostPath}:${v.containerPath}`) || [],
      Memory: 512 * 1024 * 1024, // 512MB limit
      MemorySwap: 512 * 1024 * 1024,
    },
  });

  return container;
}

export async function runContainer(
  container: Docker.Container,
  timeout: number = 300000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  await container.start();

  const stream = await container.logs({
    follow: true,
    stdout: true,
    stderr: true,
  });

  let stdout = "";
  let stderr = "";

  stream.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    if (chunk[0] === 1) {
      stdout += text;
    } else {
      stderr += text;
    }
  });

  // Wait for container to finish or timeout
  const timeoutPromise = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error("Container timeout")), timeout)
  );

  const containerPromise = container.wait();

  try {
    await Promise.race([containerPromise, timeoutPromise]);
  } finally {
    await container.stop();
    await container.remove();
  }

  const exitCode = (await containerPromise).StatusCode || 0;

  return {
    stdout,
    stderr,
    exitCode,
  };
}

export async function runMigration(projectPath: string): Promise<string> {
  const docker = getDockerClient();
  const container = await createContainer({
    image: "node:20-alpine",
    cmd: ["sh", "-c", "npm install && npm run db:generate && npm run db:migrate"],
    env: {
      DATABASE_URL: "file:./db.sqlite",
    },
    volumes: [
      {
        hostPath: projectPath,
        containerPath: "/app",
      },
    ],
    workingDir: "/app",
  });

  const result = await runContainer(container);
  if (result.exitCode !== 0) {
    throw new Error(`Migration failed: ${result.stderr}`);
  }

  return result.stdout;
}

export async function runBuild(projectPath: string): Promise<string> {
  const docker = getDockerClient();
  const container = await createContainer({
    image: "node:20-alpine",
    cmd: ["sh", "-c", "npm install && npm run build"],
    env: {
      NODE_ENV: "production",
    },
    volumes: [
      {
        hostPath: projectPath,
        containerPath: "/app",
      },
    ],
    workingDir: "/app",
  });

  const result = await runContainer(container);
  if (result.exitCode !== 0) {
    throw new Error(`Build failed: ${result.stderr}`);
  }

  return result.stdout;
}

