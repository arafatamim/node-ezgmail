export function parseContentTypeHeaderForEncoding(
  value: string
): BufferEncoding {
  let emailEncoding: BufferEncoding;
  // const mo = new RegExp(/charset="(.*?)"/).exec(value);
  const mo = value.match(/charset="(.*)"/);
  if (mo == null) {
    emailEncoding = "utf-8"; // dangerously assume UTF-8
  } else {
    emailEncoding = mo.groups[1] as BufferEncoding;
    // TODO: Investigate further
  }
  return emailEncoding;
}

/**
 * Returns the text in `emailText` upto the quoted "reply" text that begins with
 * "On Sun, Jan 1, 2018 at 12:00 PM me@company.com wrote:" part.
 * @param emailText
 */
export function removeQuotedParts(emailText: string) {
  const replyPattern = new RegExp(
    /On (Sun|Mon|Tue|Wed|Thu|Fri|Sat), (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d+, \d\d\d\d at \d+:\d+ (AM|PM) (.*?) wrote:/
  );

  const matches = emailText.match(replyPattern);
  if (matches == null) {
    return emailText;
  } else {
    return emailText.substring(0, matches.index).trimEnd();
  }
}
