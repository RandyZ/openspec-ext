import en from './locales/en.json';
import zhCn from './locales/zh-cn.json';

export type LocaleKey = keyof typeof en;

const locales: Record<string, Record<string, string>> = {
  en,
  'zh-cn': zhCn,
};

let currentLocale = 'en';

export function setLocale(locale: string): void {
  const normalized = locale.toLowerCase();
  if (normalized.startsWith('zh')) {
    currentLocale = 'zh-cn';
  } else {
    currentLocale = 'en';
  }
}

export function getLocale(): string {
  return currentLocale;
}

export function t(key: LocaleKey, params?: Record<string, string | number>): string {
  const dict = locales[currentLocale] ?? locales['en'];
  let text = dict[key] ?? locales['en'][key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}
