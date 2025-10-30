import { Octokit } from "@octokit/rest";

export function createGitHubClient(accessToken: string): Octokit {
  return new Octokit({
    auth: accessToken,
  });
}

export async function createRepository(
  client: Octokit,
  name: string,
  description?: string,
  privateRepo: boolean = false
): Promise<{ fullName: string; url: string }> {
  const response = await client.repos.createForAuthenticatedUser({
    name,
    description,
    private: privateRepo,
    auto_init: true,
  });

  return {
    fullName: response.data.full_name,
    url: response.data.html_url,
  };
}

export async function createOrUpdateFile(
  client: Octokit,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha?: string
): Promise<void> {
  const encodedContent = Buffer.from(content).toString("base64");

  await client.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: encodedContent,
    ...(sha && { sha }),
  });
}

export async function getFileContent(
  client: Octokit,
  owner: string,
  repo: string,
  path: string
): Promise<{ content: string; sha: string }> {
  const response = await client.repos.getContent({
    owner,
    repo,
    path,
  });

  if (Array.isArray(response.data)) {
    throw new Error("Path is a directory");
  }

  if (response.data.type !== "file") {
    throw new Error("Path is not a file");
  }

  const content = Buffer.from(response.data.content, "base64").toString("utf-8");
  return {
    content,
    sha: response.data.sha,
  };
}

export async function createCommit(
  client: Octokit,
  owner: string,
  repo: string,
  files: Array<{ path: string; content: string; sha?: string }>,
  message: string,
  branch: string = "main"
): Promise<void> {
  const tree = await Promise.all(
    files.map(async (file) => {
      const content = Buffer.from(file.content).toString("base64");
      const blobResponse = await client.git.createBlob({
        owner,
        repo,
        content,
        encoding: "base64",
      });

      return {
        path: file.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blobResponse.data.sha,
      };
    })
  );

  const refResponse = await client.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });

  const commitResponse = await client.git.createCommit({
    owner,
    repo,
    message,
    tree: tree[0].sha,
    parents: [refResponse.data.object.sha],
  });

  await client.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commitResponse.data.sha,
  });
}

export async function syncFilesToRepo(
  client: Octokit,
  owner: string,
  repo: string,
  files: Record<string, string>,
  commitMessage: string = "Update generated files"
): Promise<void> {
  const fileEntries = Object.entries(files);

  // Get existing files to get SHAs for updates
  const existingFiles = await Promise.allSettled(
    fileEntries.map(async ([path]) => {
      try {
        const file = await getFileContent(client, owner, repo, path);
        return { path, sha: file.sha };
      } catch {
        return { path, sha: undefined };
      }
    })
  );

  const filesWithSha = fileEntries.map(([path, content], index) => {
    const existing = existingFiles[index];
    return {
      path,
      content,
      sha: existing.status === "fulfilled" ? existing.value.sha : undefined,
    };
  });

  await createCommit(client, owner, repo, filesWithSha, commitMessage);
}

