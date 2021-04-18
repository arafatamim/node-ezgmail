import { gmail_v1 as gmail } from "googleapis";
import {
  parseContentTypeHeaderForEncoding,
  removeQuotedParts,
} from "./lib/utils";
import { EZGmailError } from "./types";
import type { AttachmentInfo, ReplyArgs } from "./types";
import { GmailClient } from "./GmailClient";
import path from "path";
import fs from "fs";

export class GmailMessage {
  messageObj: gmail.Schema$Message;
  id?: string;
  /** String like `Google <no-reply@accounts.google.com>` or just `no-reply@accounts.google.com`. */
  sender?: string;
  /** Example, `someone@email.com`. */
  recipient?: string;
  subject?: string;
  /** Contains the full message body with the quoted reply parts. */
  originalBody?: string;
  threadId?: string;
  /**
   * Contains text upto the quoted "reply" text that begins with
   * "On Sun, Jan 1, 2018 at 12:00 PM someone@email.com wrote:" part.
   */
  body?: string;
  /** Contains a string of up to the first 200 characters of the body */
  snippet?: string;
  historyId?: string;
  /** A `Date` object of the internal message creation timestamp (epoch ms) */
  timestamp?: Date;
  attachments?: string[];
  private _attachmentsInfo?: AttachmentInfo[];

  constructor(messageObj: gmail.Schema$Message) {
    this.messageObj = messageObj;
    this.id = messageObj.id;
    this.threadId = messageObj.threadId;
    this.snippet = messageObj.snippet;
    this.historyId = messageObj.historyId;
    this.timestamp = new Date(Number(messageObj.internalDate));
    let emailEncoding: BufferEncoding;

    for (const header of messageObj.payload.headers) {
      if (header.name.toUpperCase() === "FROM") {
        this.sender = header.value;
      }
      if (header.name.toUpperCase() === "TO") {
        this.recipient = header.value;
      }
      if (header.name.toUpperCase() === "SUBJECT") {
        this.subject = header.value;
      }
      if (header.name.toUpperCase() === "CONTENT-TYPE") {
        emailEncoding = parseContentTypeHeaderForEncoding(header.value);
      }
    }

    if (messageObj.payload.parts != null) {
      for (const part of messageObj.payload.parts) {
        if (
          part.mimeType.toUpperCase() === "TEXT/PLAIN" &&
          part.body.data != null
        ) {
          for (const header of part.headers) {
            if (header.name.toUpperCase() === "CONTENT-TYPE") {
              emailEncoding = parseContentTypeHeaderForEncoding(header.value);
            }
          }
          this.originalBody = Buffer.from(part.body.data, "base64").toString(
            emailEncoding
          );
          this.body = removeQuotedParts(this.originalBody);
        }

        if (part.mimeType.toUpperCase() === "MULTIPART/ALTERNATIVE") {
          for (const multipartPart of part.parts) {
            if (
              multipartPart.mimeType.toUpperCase() === "TEXT/PLAIN" &&
              multipartPart.body.data
            ) {
              for (const header of multipartPart.headers) {
                if (header.name.toUpperCase() === "CONTENT-TYPE") {
                  emailEncoding = parseContentTypeHeaderForEncoding(
                    header.value
                  );
                }
              }
              this.originalBody = Buffer.from(
                multipartPart.body.data,
                "base64"
              ).toString(emailEncoding);
              this.body = removeQuotedParts(this.originalBody);
            }
          }
        }

        if (part.filename != null && part.filename != "") {
          // This gets the attachment ID. The actual attachment must be downloaded separately.
          const attachmentId = part.body.attachmentId;
          const attachmentSize = part.body.size;
          this.attachments.push(part.filename);
          this._attachmentsInfo.push({
            fileName: part.filename,
            id: attachmentId,
            size: attachmentSize,
          });
        }
      }
    } else if (messageObj.payload.body != null) {
      this.originalBody = Buffer.from(
        messageObj.payload.body.data,
        "base64"
      ).toString(emailEncoding);
      this.body = removeQuotedParts(this.originalBody);
    }
  }

  senders() {
    return [this.sender];
  }

  latestTimestamp() {
    return this.timestamp;
  }

  /**
   * Download a file attachment in this message.
   */
  async downloadAttachment(
    gmailClient: GmailClient,
    /** The file name of the attachment. */
    fileName: string,
    /** A relative or absolute path to the download location. */
    downloadFolder = ".",
    /** Specify which attachment to download if there are multiple attachments with the same name. */
    duplicateIndex = 0
  ): Promise<void> {
    if (!this.attachments.includes(fileName)) {
      throw new EZGmailError(
        `No attachment named ${fileName} found among ${Array.from(
          this.attachments.keys()
        )}`
      );
    }

    const attachmentIndex = this.attachments
      .map((v, i) => {
        if (v === fileName) return i;
      })
      .filter((v) => v != null)[duplicateIndex];
    if (attachmentIndex == null) {
      throw new EZGmailError(
        `No attachment named ${fileName} with duplicate index ${duplicateIndex}`
      );
    }

    const attachmentObj = await gmailClient.gmailService.users.messages.attachments.get(
      {
        id: this._attachmentsInfo[attachmentIndex].id,
        messageId: this.id,
        userId: "me",
      }
    );
    const attachmentData = Buffer.from(
      attachmentObj.data.data,
      "base64"
    ).toString("utf-8"); // Decode base64

    if (!fs.existsSync(downloadFolder)) {
      fs.mkdirSync(downloadFolder);
    } else if (fs.lstatSync(downloadFolder).isFile()) {
      throw new EZGmailError(`${downloadFolder} is a file, not a folder`);
    }

    await fs.promises.writeFile(
      path.join(downloadFolder, fileName),
      attachmentData
    );
  }

  /** Download all attachments in this message */
  async downloadAllAttachments(
    gmailClient: GmailClient,
    /** A relative or absolute path to the download directory. */
    downloadFolder = ".",
    /** If `false`, existing local files will not be overridden by attachments of the same filename
     * @default true */
    overwrite = true
  ) {
    if (!overwrite) {
      const attachmentFilenames = this._attachmentsInfo.map((v) => v.fileName);
      if (
        attachmentFilenames.length !== [...new Set(attachmentFilenames)].length
      ) {
        throw new EZGmailError(
          "There are duplicate filenames in attachments. Pass overwrite=true to download them anyway."
        );
      }
    }

    const downloadedAttachmentFilenames: string[] = [];

    if (!fs.existsSync(downloadFolder)) {
      fs.mkdirSync(downloadFolder);
    } else if (fs.lstatSync(downloadFolder).isFile()) {
      throw new EZGmailError(`${downloadFolder} is a file, not a folder`);
    }

    for (const attachmentInfo of this._attachmentsInfo) {
      const attachmentObj = await gmailClient.gmailService.users.messages.attachments.get(
        {
          id: attachmentInfo.id,
          messageId: this.id,
          userId: "me",
        }
      );
      const attachmentData = Buffer.from(
        attachmentObj.data.data,
        "base64"
      ).toString("utf-8");
      const downloadFilename = attachmentInfo.fileName; // TODO handle files with duplicate filenames in the future

      await fs.promises.writeFile(
        path.join(downloadFolder, downloadFilename),
        attachmentData
      );

      downloadedAttachmentFilenames.push(downloadFilename);
      return downloadedAttachmentFilenames;
    }
  }

  /** Like the `send()` function, but replies to the last message in this thread */
  reply(gmailClient: GmailClient, replyArgs: ReplyArgs) {
    const { body, cc, bcc, mimeSubtype, attachments } = replyArgs;

    gmailClient.send({
      recipient: this.sender,
      subject: this.subject,
      body,
      // TODO: attachments,
      cc,
      bcc,
      mimeSubtype,
      _threadId: this.threadId,
    });
  }

  public toString() {
    return `GmailMessage (from: ${this.sender} to:${this.recipient} timestamp:${this.timestamp} subject:${this.subject} snippet:${this.snippet})`;
  }
}
