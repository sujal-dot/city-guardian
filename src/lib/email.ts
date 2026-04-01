const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isValidEmailFormat = (email: string) => EMAIL_REGEX.test(normalizeEmail(email));
