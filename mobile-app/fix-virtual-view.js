const fs = require('fs');
const path = require('path');

const filesToFix = [
  path.join(__dirname, 'node_modules', 'react-native', 'src', 'private', 'components', 'virtualview', 'VirtualViewExperimentalNativeComponent.js'),
  path.join(__dirname, 'node_modules', 'react-native', 'src', 'private', 'components', 'virtualview', 'VirtualViewNativeComponent.js')
];

filesToFix.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(') as HostComponent<')) {
      content = content.replace(/\)\s*as\s*HostComponent<([^>]+)>;/g, '): HostComponent<$1>);');
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`[fix-virtual-view] Applied Flow syntax fix to ${path.basename(filePath)}`);
    }
  }
});
