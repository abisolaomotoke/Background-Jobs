const http = require('http');
const data = JSON.stringify({
  to: 't@test.com',
  subject: 's',
  body: 'b',
  idempotencyKey: 'k1'
});
const options = {
  host: 'localhost',
  port: 3000,
  path: '/api/jobs',
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(data)
  }
};
let first = '';
const req1 = http.request(options, (res) => {
  let s = '';
  res.on('data', (c) => (s += c));
  res.on('end', () => {
    first = s;
    const req2 = http.request(options, (res2) => {
      let s2 = '';
      res2.on('data', (c) => (s2 += c));
      res2.on('end', () => {
        console.log('first:', first);
        console.log('second:', s2);
        process.exit(0);
      });
    });
    req2.write(data);
    req2.end();
  });
});
req1.write(data);
req1.end();
