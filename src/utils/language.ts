export const getCurrentLanguage = (): string => {
  if (typeof window === 'undefined') return 'fi';
  return window.localStorage.getItem('lang') || 'fi';
};

export const switchLanguage = (lang: string): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('lang', lang);
  window.dispatchEvent(new Event('languagechange'));
};
