import https from 'https';

const weatherApiKey = process.env.VITE_WEATHER_API_KEY || process.env.WEATHER_API_KEY || '';

const options = {
  hostname: 'www.weatherunion.com',
  path: '/gw/weather/external/v0/get_weather_data?latitude=12.9716&longitude=77.5946',
  method: 'GET',
  headers: {
    'x-zomato-api-key': weatherApiKey
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(data);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.end();
