import https from 'https';
https.get('https://api.codetabs.com/v1/proxy?quest=https://sachet.ndma.gov.in/cap_public_website/FetchAllAlertDetails', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(data.substring(0, 200));
  });
});
