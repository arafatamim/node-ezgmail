import * as fs from "fs";
import * as fsp from "fs/promises";
import { Auth, gmail_v1 as gmail, google } from "googleapis";
import MailComposer from "nodemailer/lib/mail-composer";
import path from "path";
import { GmailMessage } from "./GmailMessage";
import type { SendArgs } from "./types";
import { EZGmailError, EZGmailValueError } from "./types";

export class GmailClient {
  gmailService: gmail.Gmail;
  emailAddress: string;
  loggedIn: boolean;

  async init(
    tokenFile = "token.json",
    credentialsFile = "credentials.json",
    userId = "me"
  ): Promise<GmailClient> {
    const credentials = JSON.parse(
      await fsp.readFile(credentialsFile, { encoding: "utf-8" })
    );
    const token = JSON.parse(
      await fsp.readFile(tokenFile, { encoding: "utf-8" })
    ) as Auth.Credentials;

    const { client_secret, client_id, redirect_uris } = credentials.installed;

    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );
    oAuth2Client.setCredentials(token);

    const serviceGmail = google.gmail({ auth: oAuth2Client, version: "v1" });

    this.gmailService = serviceGmail;
    return serviceGmail.users.getProfile({ userId }).then((res) => {
      this.emailAddress = res.data.emailAddress;
      this.loggedIn = res.data.emailAddress != null;
      return this;
    });
  }

  private async _createMessage(sendArgs: SendArgs): Promise<GmailMessage> {
    const {
      sender,
      recipient,
      subject,
      body,
      cc,
      bcc,
      attachments,
      mimeSubtype = "plain",
      _threadId,
    } = sendArgs;

    if (!["plain", "html"].includes(mimeSubtype)) {
      throw new EZGmailValueError(
        "Wrong string passed for mimeSubtype, must be 'plain' or 'html'"
      );
    }
    const attachmentData: [name: string, content: Buffer][] = [];

    try {
      if (attachments != null || attachments.length !== 0) {
        for (const attachment of attachments) {
          if (!fs.existsSync(attachment)) {
            throw new EZGmailError(
              `File ${path.resolve(attachment)} does not exist!`
            );
          }
          const fileBuffer = await fsp.readFile(attachment);
          attachmentData.push([attachment, fileBuffer]);
        }
      }

      const messageStream = await new MailComposer({
        to: recipient,
        from: sender,
        subject,
        cc: cc,
        bcc: bcc,
        text: mimeSubtype === "plain" ? body : undefined,
        html: mimeSubtype === "html" ? body : undefined,
        attachments:
          attachmentData.length === 0
            ? undefined
            : attachmentData.map(([filename, content]) => ({
                content,
                filename,
              })),
      })
        .compile()
        .build();
      const message = messageStream.toString("base64"); // The raw message should be in base64 format
      const gmailMessage = new GmailMessage({
        raw: message,
        threadId: _threadId,
      });
      return gmailMessage;
    } catch (e) {
      console.error(e); // This is useless lol
    }
  }

  private async _sendMessage(message: GmailMessage, userId = "me") {
    const sentResponse = await this.gmailService.users.messages.send({
      userId,
      requestBody: message.messageObj,
    });
    return sentResponse;
  }

  async send(sendArgs: SendArgs, userId = "me"): Promise<void> {
    if (this.gmailService == null)
      throw new Error("Gmail client not initialized");

    const message = await this._createMessage(sendArgs);
    // TODO: Add support for creating message with attachments
    this._sendMessage(message, userId);
  }
}
