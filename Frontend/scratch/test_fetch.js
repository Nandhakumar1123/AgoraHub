
async function testFetch() {
  try {
    const res = await fetch('https://api.expo.dev/v2/versions/latest');
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Success:', data.expoVersion);
  } catch (err) {
    console.error('Fetch failed:', err);
  }
}
testFetch();
