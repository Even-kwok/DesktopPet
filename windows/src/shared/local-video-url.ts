export function localVideoSourceURL(videoPath: string) {
  if (/^(file|https?|blob):/i.test(videoPath)) {
    return videoPath;
  }

  const normalizedPath = videoPath.replace(/\\/g, "/");
  const encodedPath = encodeLocalPath(normalizedPath);
  if (normalizedPath.startsWith("//")) {
    return `file://${encodedPath.replace(/^\/+/, "")}`;
  }

  return normalizedPath.startsWith("/")
    ? `file://${encodedPath}`
    : `file:///${encodedPath}`;
}

function encodeLocalPath(filePath: string) {
  return filePath
    .split("/")
    .map((segment) => {
      if (!segment || /^[A-Za-z]:$/.test(segment)) {
        return segment;
      }

      return encodeURIComponent(segment);
    })
    .join("/");
}
