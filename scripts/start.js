const { spawn } = require('child_process');
const path = require('path');

// Some older development environments set this flag globally. Recent Electron
// deliberately rejects it, so remove it only from the Electron child process.
const environment = { ...process.env };
delete environment.NODE_OPTIONS;

const electron = require('electron');
const child = spawn(electron, ['.', '--disable-gpu', ...process.argv.slice(2)], {
  cwd: path.resolve(__dirname, '..'),
  env: environment,
  stdio: 'inherit'
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
