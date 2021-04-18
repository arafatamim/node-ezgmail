# node-ezgmail

A simpler Node.js interface to the Gmail API.

## Setting Up

Install the package with npm by running: \
`npm install node-ezgmail`

Next, you need a `credentials.json` file from Google that you can download by following the instructions [here](https://developers.google.com/workspace/guides/create-credentials#create_a_credential)

Then, you need to generate a file containing the access token. To do that, paste the following code in a separate file and run it:

```js
// getToken.js

const { getNewToken } = require("node-ezgmail");

getNewToken();
```

When prompted, open the provided link in your browser to grant access to your account. Copy and paste the access code in the console. If all goes well, it will place a file called `token.json` in the same directory.

## Usage Examples

```js
const { GmailClient } = require("node-ezgmail");

async function main() {
  const client = await new GmailClient().init();
  console.log(client.emailAddress);

  // Send an email
  client.send({
    recipient: "someone@example.com",
    subject: "Test message subject",
  });
}
```

## Credits

This library is a loose port of [EZGmail](https://github.com/asweigart/ezgmail) written in Python by Al Sweigart.
