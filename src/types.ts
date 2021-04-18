export interface AttachmentInfo {
  fileName: string;
  id: string;
  size: number;
}

interface CommonHeaders {
  body?: string; // Both subject and body can be optional
  /** Type of email body, can be `plain` or `html` */
  mimeSubtype?: MimeSubtype;
  cc?: string;
  bcc?: string;
  attachments?: string[];
}

export interface SendArgs extends CommonHeaders {
  /** String like `Google <no-reply@accounts.google.com>` or just `no-reply@accounts.google.com` */
  sender?: string; // Defaults to email address
  /** Example, `someone@email.com` */
  recipient: string;
  subject?: string;
  _threadId?: string;
}

export interface ReplyArgs extends CommonHeaders {}

export type MimeSubtype = "plain" | "html";

export class EZGmailError extends Error {
  constructor(message?: string) {
    super(message);
    this.message = message;
    this.name = "EZGmailError";
  }
}
export class EZGmailValueError extends EZGmailError {}
export class EZGmailTypeError extends EZGmailError {}
