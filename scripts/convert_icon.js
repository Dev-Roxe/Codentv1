const fs = require('fs');
const pngToIco = require('png-to-ico');

const source = 'src/renderer/assets/icons/app.png';
const dest = 'src/renderer/assets/icons/app.ico';

pngToIco(source)
  .then(buf => {
    fs.writeFileSync(dest, buf);
    console.log('Icon creation successful!');
  })
  .catch(console.error);
