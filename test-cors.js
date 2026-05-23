import https from 'https';

const options = {
  hostname: 'www.weatherunion.com',
  path: '/gw/weather/external/v0/get_weather_data?latitude=12.9716&longitude=77.5946',
  method: 'OPTIONS',
  headers: {
    'Origin': 'http://localhost:3000',
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'x-zomato-api-key'
  }
};

const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
});

req.on('error', (error) => {
  console.error(error);
});

req.end();
