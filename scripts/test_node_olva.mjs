import fetch from 'node-fetch';

const API_KEY = 'sk_614980da4cc14fd60bf8366e7f35bc85512f624b65ee45ff364c1a42aac15e05';

async function main() {
  const res = await fetch('https://api.olva-api-peru.com/v1/agencias?limit=5&page=1', {
    headers: {
      'X-API-Key': API_KEY,
      'User-Agent': 'Mozilla/5.0'
    }
  });

  const data = await res.json();
  console.log('Node.js fetch result:');
  console.log(JSON.stringify(data.results.slice(0, 3), null, 2));
}

main();
