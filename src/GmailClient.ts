import { gmail_v1 as gmail, Auth, google } from "googleapis";
import MailComposer from "nodemailer/lib/mail-composer";
import * as fs from "fs/promises";
import { EZGmailValueError } from "./types";
import type { SendArgs } from "./types";
import { GmailMessage } from "./GmailMessage";

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
      await fs.readFile(credentialsFile, { encoding: "utf-8" })
    );
    const token = JSON.parse(
      await fs.readFile(tokenFile, { encoding: "utf-8" })
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
      mimeSubtype = "plain",
      _threadId,
    } = sendArgs;

    if (!["plain", "html"].includes(mimeSubtype)) {
      throw new EZGmailValueError(
        "Wrong string passed for mimeSubtype, must be 'plain' or 'html'"
      );
    }
    try {
      const messageStream = await new MailComposer({
        to: recipient,
        from: sender,
        subject,
        cc: cc,
        bcc: bcc,
        text: mimeSubtype === "plain" ? body : undefined,
        html: mimeSubtype === "html" ? body : undefined,
      })
        .compile()
        .build();
      const message = messageStream.toString("base64"); // The raw message should be in base64 format
      const rawMessage = new GmailMessage({
        raw: message,
        threadId: _threadId,
      });
      return rawMessage;
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
