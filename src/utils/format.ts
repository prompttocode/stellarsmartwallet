export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Có lỗi không rõ';
}

export function shortAddress(address?: string) {
  if (!address) {
    return 'Chưa có';
  }

  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

export function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  });
}

export function isEmailLike(emailValue: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue.trim());
}
