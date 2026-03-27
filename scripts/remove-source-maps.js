const fs = require('fs');
const path = require('path');

function removeSourceMaps(dir) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      removeSourceMaps(fullPath);
    } else if (file.endsWith('.map')) {
      console.log(`Removing source map: ${fullPath}`);
      fs.unlinkSync(fullPath);
    }
  });
}

console.log('🧹 Cleaning up source maps...');
removeSourceMaps('.next');
console.log('✅ Source maps removed successfully');