export function pageBounds(
  total: number,
  requestedPage: number,
  pageSize: number,
) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(requestedPage, pageCount));
  const start = (page - 1) * pageSize;
  return { page, pageCount, start, end: Math.min(start + pageSize, total) };
}
