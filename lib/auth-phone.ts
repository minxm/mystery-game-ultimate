/** 将用户输入规范为 E.164 格式（默认中国大陆 +86） */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) {
      return `+${digits}`;
    }
    return null;
  }

  const digits = trimmed.replace(/\D/g, '');

  // 中国大陆 11 位手机号
  if (/^1\d{10}$/.test(digits)) {
    return `+86${digits}`;
  }

  // 带 86 前缀
  if (/^86\d{11}$/.test(digits)) {
    return `+${digits}`;
  }

  return null;
}

export function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length < 7) return e164;
  return e164.replace(/\d(?=\d{4})/g, '*');
}
