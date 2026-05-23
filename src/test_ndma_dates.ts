import https from 'https';
https.get('https://api.codetabs.com/v1/proxy/?quest=https://sachet.ndma.gov.in/cap_public_website/FetchAllAlertDetails', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log("Sample dates:");
      for (let i = 0; i < Math.min(5, json.length); i++) {
        console.log("effective_start_time:", json[i].effective_start_time);
      }
    } catch (e) {
      console.error("Error parsing JSON. Data starts with:", data.substring(0, 100));
    }
  });
});
