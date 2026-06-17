const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

try {
    const htmlPath = path.join(__dirname, 'public/index.html');
    console.log('Reading HTML from:', htmlPath);
    const html = fs.readFileSync(htmlPath, 'utf8');

    const dom = new JSDOM(html);
    const document = dom.window.document;

    console.log('--- JSDOM Element Verification ---');
    console.log('Page Title:', document.title);
    
    // Check main panels
    console.log('sensorsCard exists:', !!document.getElementById('sensorsCard'));
    console.log('flowPanel exists:', !!document.getElementById('flowPanel'));
    console.log('timer-section class count:', document.querySelectorAll('.timer-section').length);
    
    // Check specific timer IDs
    console.log('btnCustomTimer exists:', !!document.getElementById('btnCustomTimer'));
    console.log('customTimerForm exists:', !!document.getElementById('customTimerForm'));
    console.log('inputCustomMinutes exists:', !!document.getElementById('inputCustomMinutes'));
    console.log('btnApplyCustomTimer exists:', !!document.getElementById('btnApplyCustomTimer'));
    console.log('activeTimerPanel exists:', !!document.getElementById('activeTimerPanel'));
    console.log('activeTimerText exists:', !!document.getElementById('activeTimerText'));
    console.log('btnCancelTimer exists:', !!document.getElementById('btnCancelTimer'));
    
    // Check motor buttons
    console.log('btnMotorA exists:', !!document.getElementById('btnMotorA'));
    console.log('btnMotorB exists:', !!document.getElementById('btnMotorB'));
    console.log('btnMotorFull exists:', !!document.getElementById('btnMotorFull'));
    console.log('btnMotorOff exists:', !!document.getElementById('btnMotorOff'));
    
    console.log('--- End of Verification ---');
} catch (err) {
    console.error('Error during validation:', err);
}
