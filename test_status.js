const http = require('http');
const id = process.argv[2];
const options = {
  host: 'localhost',
  port: 3000,
  path: '/api/jobs/' + id,
  method: 'GET'
};
const req = http.request(options, (res) => {
  let s = '';
  res.on('data', (c) => (s += c));
  res.on('end', () => {
    console.log(s);
    process.exit(0);
  });
});
req.end();
