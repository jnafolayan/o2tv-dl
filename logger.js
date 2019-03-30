const chalk = require('chalk');

const colors = {
  info: "blue",
  warning: "yellow",
  success: "green",
  error: "red"
};

const info = makeLog('info');
const warn = makeLog('warning');
const error = makeLog('error');

module.exports = {
  info,
  warn,
  error
};

function makeLog(type) {
  const write = chalk[colors[type]];

  return function(msg) {
    console.log(`${write(type)} ${msg}`);
  }
}