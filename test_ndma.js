const https = require('https');
https.get('https://api.codetabs.com/v1/proxy?quest=https://sachet.ndma.gov.in/cap_public_website/FetchAllAlertDetails', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json[0], null, 2));
    } catch (e) {
      console.error(e);
    }
  });
});
