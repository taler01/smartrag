import http from 'http';
import { JSDOM } from 'jsdom';

const options = {
  hostname: '10.168.27.191',
  port: 3000,
  path: '/',
  method: 'GET',
  headers: {
    'Accept': 'text/html',
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    console.log('Response Headers:', res.headers);
    
    // Create a virtual DOM
    const dom = new JSDOM(data, {
      url: 'http://10.168.27.191:3000',
      pretendToBeVisual: true,
      resources: "usable"
    });
    
    const { document } = dom.window;
    
    // Check if root element exists
    const rootElement = document.getElementById('root');
    console.log('Root element found:', !!rootElement);
    
    if (rootElement) {
      console.log('Root element content:', rootElement.innerHTML);
    }
    
    // Check for any script errors
    const scripts = document.querySelectorAll('script');
    console.log('Number of scripts found:', scripts.length);
    
    scripts.forEach((script, index) => {
      if (script.src) {
        console.log(`Script ${index}:`, script.src);
      } else {
        console.log(`Inline Script ${index}:`, script.textContent.substring(0, 100) + '...');
      }
    });
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();