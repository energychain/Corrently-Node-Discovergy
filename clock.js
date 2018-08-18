const { exec } = require('child_process');

function executer() {
  process.env.IDLE_EXIT=1800000;
  exec('node worker.js', (error, stdout, stderr) => {
  if (error) {
    console.error(`exec error: ${error}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
  console.log(`stderr: ${stderr}`);
});
}

setInterval(executer,3600000*4);
executer();
