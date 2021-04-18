import { google } from "googleapis";
import * as fs from "fs";
import readline from "readline";

const SCOPES = ["https://mail.google.com"];
/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param oAuth2Client The OAuth2 client to get token for.
 */
export async function getNewToken(
  credentialsFile = "credentials.json",
  tokenFile = "token.json"
): Promise<void> {
  const credentials = JSON.parse(fs.readFileSync(credentialsFile, "utf-8"));
  const { client_secret, client_id, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });

  console.log("Authorize this app by visiting this url:", authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Enter the code from that page here: ", async (code) => {
    rl.close();
    oAuth2Client.getToken(code, function (err, token) {
      if (err || token == null) {
        console.error(err);
        console.error("Could not obtain token");
      } else {
        oAuth2Client.setCredentials(token);
        fs.writeFileSync(tokenFile, JSON.stringify(token));
        console.log("Token obtained successfully");
      }
    });
  });
}
