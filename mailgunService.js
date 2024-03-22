// mailgunService.js
const formData = require("form-data");
const Mailgun = require("mailgun.js");
const mailgun = new Mailgun(formData);

const DOMAIN = process.env.MAILGUN_DOMAIN;
const API_KEY = process.env.MAILGUN_API_KEY;

const client = mailgun.client({ username: "api", key: API_KEY });

function sendEmail(
  to,
  subject,
  text,
  from = "Excited User <me@samples.mailgun.org>",
) {
  const data = {
    from,
    to,
    subject,
    text,
  };

  return client.messages
    .create(DOMAIN, data)
    .then((msg) => console.log(msg)) // logs response data
    .catch((err) => console.error(err)); // logs any error
}

module.exports = { sendEmail };
