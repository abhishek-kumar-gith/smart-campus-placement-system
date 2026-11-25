function getErrorMessage(error, fallback) {
  const data = error.response?.data;
  if (data instanceof Blob) {
    return data.text()
      .then((text) => {
        try {
          return JSON.parse(text).message || fallback;
        } catch {
          return fallback;
        }
      });
  }
  return Promise.resolve(data?.message || fallback);
}

export async function transferProtectedPdf({
  api,
  endpoint,
  fileName,
  download,
  onError,
  blockedMessage,
  failureMessage,
}) {
  let viewerWindow = null;
  if (!download) {
    viewerWindow = window.open('about:blank', '_blank');
    if (!viewerWindow) {
      onError(blockedMessage);
      return false;
    }
    viewerWindow.opener = null;
  }

  let objectUrl = null;
  try {
    const response = await api.get(endpoint, { responseType: 'blob' });
    objectUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    if (download) {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName || 'document.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } else {
      viewerWindow.location.replace(objectUrl);
      const cleanup = window.setInterval(() => {
        if (viewerWindow.closed) {
          window.clearInterval(cleanup);
          URL.revokeObjectURL(objectUrl);
        }
      }, 1000);
    }
    return true;
  } catch (error) {
    viewerWindow?.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    onError(await getErrorMessage(error, failureMessage));
    return false;
  }
}
