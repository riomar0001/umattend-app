export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error == null) return fallback;
  const maybeAxios = error as { response?: { data?: { message?: string } } };
  if (maybeAxios.response?.data?.message) {
    return maybeAxios.response.data.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
