const RAW_MEDIA_ALLOWED_AGENTS = new Set([
  "perception-extractor",
  "ad-creative-refiner",
  "image-prompt-adapter",
]);

const FORBIDDEN_ARTIFACTS_BY_AGENT = {
  "market-context-researcher": [
    /(?:^|\/)creative-diff\.json$/i,
    /(?:^|\/)change-candidates\.json$/i,
    /(?:^|\/)interpreted-change-events\.json$/i,
    /(?:^|\/)creative-change-report\.json$/i,
  ],
};

const RAW_MEDIA_KEY_RE = /^(?:raw_)?(?:image|images|image_path|image_paths|image_file|image_files|image_url|image_urls|media|media_path|media_paths|video|video_path|video_file|poster_image|poster_images)$/i;
const BROWSER_ARTIFACT_KEY_RE = /(?:browser|cdp|dom|network|har|screenshot|html).*(?:log|logs|artifact|artifacts|dump|trace|snapshot|snapshots)?$/i;
const CREDENTIAL_KEY_RE = /(?:credential|credentials|password|cookie|cookies|auth_token|access_token|refresh_token|login_state)$/i;
const MEDIA_STRING_RE = /(?:^data:image\/|^file:\/\/.*\.(?:png|jpe?g|webp|gif|heic|avif|mp4)(?:$|[?#])|^\/.*\.(?:png|jpe?g|webp|gif|heic|avif|mp4)(?:$|[?#])|(?:^|[/(])ad-creatives\/[^"'\s)]+\/(?:images|videos)\/[^"'\s)]+\.(?:png|jpe?g|webp|gif|mp4)(?:$|[?#])|!\[[^\]]*\]\([^)]+\.(?:png|jpe?g|webp|gif|mp4)[^)]*\))/i;
const RUN_IMAGE_REF_RE = /^runs\/[^/]+\/ad-creatives\/[^/]+\/(?:images|videos)\/[^/]+\.(?:png|jpe?g|webp|gif|mp4)$/i;

function pathLabel(path) {
  return path.length ? path.join(".") : "(root)";
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function last(path) {
  return path[path.length - 1] || "";
}

function isAllowedIdentityImageRef(key, value) {
  return key === "image_ref" && RUN_IMAGE_REF_RE.test(value);
}

function stringViolatesForbiddenArtifact(agentName, value) {
  for (const pattern of FORBIDDEN_ARTIFACTS_BY_AGENT[agentName] || []) {
    if (pattern.test(value)) return pattern;
  }
  return null;
}

function walk(value, path, ctx) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, [...path, String(index)], ctx));
    return;
  }

  if (isPlainObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      const nextPath = [...path, key];
      if (!ctx.rawMediaAllowed && RAW_MEDIA_KEY_RE.test(key)) {
        ctx.errors.push(`raw media key not allowed for ${ctx.agentName}: ${pathLabel(nextPath)}`);
      }
      if (BROWSER_ARTIFACT_KEY_RE.test(key)) {
        ctx.errors.push(`browser artifact/log key not allowed for ${ctx.agentName}: ${pathLabel(nextPath)}`);
      }
      if (CREDENTIAL_KEY_RE.test(key)) {
        ctx.errors.push(`credential key not allowed for ${ctx.agentName}: ${pathLabel(nextPath)}`);
      }
      if (key === "persona_id" && ctx.persona_id && typeof item === "string" && item !== ctx.persona_id) {
        ctx.errors.push(`other persona leaked into ${ctx.agentName}: ${pathLabel(nextPath)}=${item}`);
      }
      walk(item, nextPath, ctx);
    }
    return;
  }

  if (typeof value !== "string") return;

  const artifactPattern = stringViolatesForbiddenArtifact(ctx.agentName, value);
  if (artifactPattern) {
    ctx.errors.push(`forbidden artifact for ${ctx.agentName}: ${pathLabel(path)}=${value}`);
  }

  if (!ctx.rawMediaAllowed && MEDIA_STRING_RE.test(value) && !isAllowedIdentityImageRef(last(path), value)) {
    ctx.errors.push(`raw media path not allowed for ${ctx.agentName}: ${pathLabel(path)}=${value}`);
  }
}

export function validateSubagentProjection(agentName, handoff, options = {}) {
  const ctx = {
    agentName,
    persona_id: options.persona_id,
    rawMediaAllowed: RAW_MEDIA_ALLOWED_AGENTS.has(agentName),
    errors: [],
  };
  if (!agentName || typeof agentName !== "string") {
    ctx.errors.push("agentName is required");
    return { ok: false, errors: ctx.errors };
  }
  walk(handoff, [], ctx);
  return { ok: ctx.errors.length === 0, errors: ctx.errors };
}

export function assertSubagentProjection(agentName, handoff, options = {}) {
  const result = validateSubagentProjection(agentName, handoff, options);
  if (!result.ok) throw new Error(result.errors.join("\n"));
  return result;
}
